import { Page, expect } from '@playwright/test';
import { authenticator } from 'otplib';
import { ENV } from '../config/environments';

export class FlowBase {
  constructor(protected page: Page) {}

  /** Full login flow: email + password (single-step) → OTP if required → wait for post-login page */
  async loginForFlow(
    email: string = ENV.PERSONAL_EMAIL,
    password: string = ENV.USER_PASSWORD,
  ): Promise<void> {
    // Use domcontentloaded — prevents 3rd-party resources (reCAPTCHA, analytics) from
    // stalling the navigation and causing a 30s timeout.
    // Retry once on transient network errors (seen live: net::ERR_NETWORK_CHANGED when the Mac's
    // network flips mid-run) — a real outage still fails on the second attempt.
    try {
      await this.page.goto(ENV.BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    } catch (e) {
      if (!/net::ERR_(NETWORK_CHANGED|INTERNET_DISCONNECTED|CONNECTION_RESET|NAME_NOT_RESOLVED|TIMED_OUT)/.test(String(e))) throw e;
      await this.page.waitForTimeout(5_000);
      await this.page.goto(ENV.BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    }
    // Staging gateway hiccup (seen live): plain-text "upstream connect error … connection termination"
    // instead of the app. Reload up to twice before giving up.
    for (let i = 0; i < 2; i++) {
      const body = (await this.page.locator('body').innerText({ timeout: 5_000 }).catch(() => '')) || '';
      if (!/upstream connect error|no healthy upstream|502 Bad Gateway|503 Service/i.test(body)) break;
      await this.page.waitForTimeout(5_000);
      await this.page.goto(ENV.BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    }

    // If the context has a valid device-trust cookie (set by auth.setup.ts), the server
    // redirects /login to /dashboard immediately (no form shown at all). But the redirect
    // may be a client-side router.push() that fires AFTER domcontentloaded. Wait briefly
    // for React to hydrate and any client-side redirect to complete before checking the URL.
    await this.page.waitForTimeout(1_500);
    const landedOn = new URL(this.page.url()).pathname;
    const alreadyOnDashboard = /^\/(dashboard|home|business-account\/dashboard)/.test(landedOn);

    if (alreadyOnDashboard) {
      if (email === ENV.PERSONAL_EMAIL) {
        // Already authenticated as the default personal user — accept it.
        await this.dismissAllOverlays();
        return;
      }
      // Authenticated as a DIFFERENT user — clear session and start fresh.
      await this.page.goto(ENV.BASE_URL + '/logout', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await this.page.goto(ENV.BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
    }

    // Dismiss cookie banner if present
    await this.dismissCookies();

    // CP shows a "Session expired" dialog (id="user-session-expired") when the session
    // cookie has expired but the device-trust cookie is still present.
    // Primary-action button: id="dialog-button-primaryAction" (Dialog.tsx:227) — "Got it"
    // Close icon fallback:   id="close-dialog" (Dialog.tsx:181)
    await this.dismissSessionExpiredDialog();

    // CP login is a SINGLE-STEP form — both #email and #password are visible simultaneously.
    // Fill email first, then password, then click #save-changes ONCE.
    // click() before fill() ensures React's focus/onChange events fire correctly with
    // react-hook-form (which tracks field state internally, not just DOM value).
    const emailInput = this.page.locator('#email, input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 15_000 });
    await emailInput.click();
    await emailInput.fill(email);
    await this.page.keyboard.press('Tab'); // blur email → react-hook-form registers value

    const passwordInput = this.page.locator('#password, input[type="password"]').first();
    await passwordInput.waitFor({ state: 'visible', timeout: 10_000 });
    await passwordInput.click();
    await passwordInput.fill(password);
    await this.page.keyboard.press('Tab'); // blur password → react-hook-form registers value

    // Check "Remember this device" so the server sets a long-lived device-trust cookie.
    // Login.tsx: <input id='checkbox' type="checkbox" ...> (line ~355)
    const rememberCheckbox = this.page.locator('#checkbox, input[type="checkbox"]').first();
    const rememberVisible = await rememberCheckbox.isVisible().catch(() => false);
    if (rememberVisible) {
      const isChecked = await rememberCheckbox.isChecked().catch(() => false);
      if (!isChecked) await rememberCheckbox.check({ force: true }).catch(() => {});
    }

    await this.page.locator('#save-changes').first().click({ force: true });

    // OTP step — CP CodeVerificationInput renders id="code-1" through id="code-6"
    // (type="text", inputMode="numeric" — NOT input[maxlength="1"])
    // Some accounts skip OTP entirely — treat as optional.
    const outcome = await this.waitForLoginOutcome(true);
    const otpVisible = outcome === 'otp';

    if (otpVisible) {
      // ENTER_OTP can be:
      //   - A 6-digit static code (e.g. '121212') → use directly
      //   - A Base32 TOTP secret (e.g. 'JBSWY3DPEHPK3PXP') → generate via authenticator
      const otpSecret = ENV.ENTER_OTP || '';
      const otp = /^\d{6}$/.test(otpSecret)
        ? otpSecret                          // static 6-digit code — use as-is
        : authenticator.generate(otpSecret); // Base32 TOTP secret — generate TOTP

      // Fill each digit using fill() — triggers React's synthetic onChange events.
      // pressSequentially was too slow (click() waits for full actionability per digit)
      // and caused overall test timeout when OTP inputs had animation/overlay delays.
      for (let i = 0; i < otp.length; i++) {
        const digitInput = this.page.locator(`#code-${i + 1}`);
        await digitInput.fill(otp[i]);
        await this.page.waitForTimeout(30); // brief pause for React state update
      }

      // Login OTP button: id="verify_code" (underscore) in VerificationCodeScreen.tsx
      // Signup/2FA button: id="verify-code" (dash) in 2FAVerification.tsx
      // Use a combined selector to handle both contexts.
      const verifyBtn = this.page.locator('#verify_code, #verify-code').first();
      const verifyVisible = await verifyBtn
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
      // The app may auto-submit once the 6th digit is entered — in that case the button
      // is already disabled (request in flight). Only click when it is still enabled, so
      // we never double-submit the code.
      if (verifyVisible && await verifyBtn.isEnabled().catch(() => false)) {
        await verifyBtn.click({ force: true });
      }
    }

    await this.waitForLoginOutcome(false);
    await this.dismissAllOverlays();
  }

  /** Wait for a real authentication outcome instead of treating every non-login URL as success. */
  private async waitForLoginOutcome(allowOtp: boolean): Promise<string> {
    let outcome = '';
    // CP Alert for login errors: id="transfer-detail-compliance-notification" (Login.tsx:334)
    // Fallback: id="message" (legacy / other pages)
    // CP OTP verification error: id="error-message" (VerificationCodeScreen.tsx)
    const loginError = this.page
      .locator('#transfer-detail-compliance-notification, #message')
      .filter({ hasText: /\S/ })
      .first();
    const otpError   = this.page.locator('#error-message').filter({ hasText: /\S/ }).first();
    // While the OTP is being verified, CP keeps the #code-1..6 boxes on screen behind a
    // spinner and disables "Verify code". That is NOT a failure — only treat the OTP
    // screen as failed once it has been idle (no spinner, button enabled) for a while.
    const OTP_IDLE_FAIL_MS = 8_000;
    let otpIdleSince: number | null = null;
    const verifyBusy = async (): Promise<boolean> => {
      const spinner = await this.page.locator('[role="progressbar"]').first().isVisible().catch(() => false);
      if (spinner) return true;
      const btn = this.page.locator('#verify_code, #verify-code').first();
      if (await btn.isVisible().catch(() => false)) {
        return !(await btn.isEnabled().catch(() => true));
      }
      return false;
    };
    await expect.poll(async () => {
      // If session-expired dialog re-appears mid-poll (e.g. after form submit),
      // dismiss it so the page can proceed to dashboard.
      const sessionHeading = this.page
        .locator('h1, h2, h3').filter({ hasText: /session expired/i }).first();
      if (await sessionHeading.isVisible().catch(() => false)) {
        const gotItBtn = this.page.locator('#dialog-button-primaryAction, button')
          .filter({ hasText: /^got it$/i }).first();
        if (await gotItBtn.isVisible().catch(() => false)) {
          await gotItBtn.click({ force: true }).catch(() => {});
        }
        return '';
      }

      const path = new URL(this.page.url()).pathname;
      if (/^\/(?:business-account\/)?(?:dashboard|home)(?:\/|$)/.test(path)) {
        outcome = 'dashboard';
      } else if (await loginError.isVisible()) {
        outcome = 'error';
      } else if (allowOtp && await this.page.locator('#code-1').isVisible()) {
        outcome = 'otp';
      } else if (await otpError.isVisible()) {
        // Real OTP error from the server (wrong/expired code) — fail fast with its text.
        outcome = 'error';
      } else if (!allowOtp && await this.page.locator('#code-1').isVisible()) {
        if (await verifyBusy()) {
          // Verification request still in flight — keep waiting.
          otpIdleSince = null;
          outcome = '';
        } else {
          otpIdleSince ??= Date.now();
          // OTP screen sat idle with no error and no redirect → code was silently rejected.
          outcome = Date.now() - otpIdleSince >= OTP_IDLE_FAIL_MS ? 'otp-failed' : '';
        }
      } else {
        outcome = '';
      }
      return outcome;
    }, { timeout: 45_000, message: 'Expected dashboard, login error, or required OTP step' })
      .toMatch(/^(dashboard|error|otp|otp-failed)$/);

    if (outcome === 'error') {
      const errText = await loginError.isVisible()
        ? (await loginError.innerText()).trim()
        : (await otpError.innerText().catch(() => 'unknown error'));
      throw new Error(`Authentication failed: ${errText}`);
    }
    if (outcome === 'otp-failed') {
      const errText = await otpError.isVisible()
        ? (await otpError.innerText()).trim()
        : 'OTP verification failed — wrong code or expired';
      throw new Error(`Authentication failed: ${errText}`);
    }
    return outcome;
  }

  /**
   * Wraps a step with console logging and optional delay.
   * @param label  Step name shown in output
   * @param fn     Async function to execute
   * @param delay  Optional milliseconds to wait after the step
   */
  async step<T>(label: string, fn: () => Promise<T>, delay?: number): Promise<T> {
    console.log(`  ▶ ${label}`);
    const result = await fn();
    if (delay) await this.page.waitForTimeout(delay);
    return result;
  }

  /**
   * Dismisses the "Session expired" dialog that CP shows on /login when the
   * session cookie has expired but the device-trust cookie is still present.
   *
   * Detection uses the "Session expired" heading text — more reliable than
   * id="user-session-expired" which may not be present in all CP builds.
   * Button click uses "Got it" text — more reliable than id="dialog-button-primaryAction".
   */
  async dismissSessionExpiredDialog(): Promise<void> {
    // Detect by heading text — works regardless of whether #user-session-expired ID is rendered
    const sessionHeading = this.page
      .locator('h1, h2, h3, [class*="heading"], [class*="title"]')
      .filter({ hasText: /session expired/i })
      .first();

    const headingVisible = await sessionHeading.isVisible().catch(() => false);
    if (!headingVisible) return;

    // "Got it" button — try id-based first, then text-based
    const gotItBtn = this.page
      .locator('#dialog-button-primaryAction, button')
      .filter({ hasText: /^got it$/i })
      .first();

    if (await gotItBtn.isVisible().catch(() => false)) {
      await gotItBtn.click({ force: true }).catch(() => {});
    } else {
      // Fallback: close icon
      const closeBtn = this.page
        .locator('#close-dialog, [id*="close"], button[aria-label*="close" i]')
        .first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click({ force: true }).catch(() => {});
      }
    }

    // Wait for heading to disappear (dialog closed)
    await sessionHeading.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
    // Brief pause for dialog exit animation
    await this.page.waitForTimeout(300);
  }

  /** Dismisses the cookie consent banner if it is visible. */
  async dismissCookies(): Promise<void> {
    // CookieDialog.tsx renders id="cookie-accept-all" and id="cookie-decline-all".
    // The dialog is rendered CLIENT-SIDE by React AFTER hydration, so it may not
    // exist yet immediately after goto(..., { waitUntil: 'domcontentloaded' }).
    // We wait up to 5s for it to appear; if it never shows, we skip.
    //
    // Accept all so reCAPTCHA (Google) and other auth-required scripts can load.
    // After acceptance, wait 2s for reCAPTCHA to initialise before the form submit.
    const acceptBtn = this.page.locator(
      '#cookie-accept-all, button:has-text("Accept all"), button:has-text("Accept All")'
    ).first();
    const declineBtn = this.page.locator(
      '#cookie-decline-all, button:has-text("Decline all"), button:has-text("Decline All")'
    ).first();

    // Wait up to 5s for the dialog to render (React hydration delay)
    const appeared = await acceptBtn
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (appeared) {
      await acceptBtn.click({ force: true }).catch(() => {});
      await acceptBtn.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
      // Wait for Google reCAPTCHA to finish initialising after cookie acceptance
      await this.page.waitForTimeout(2_000);
    } else if (await declineBtn.isVisible().catch(() => false)) {
      await declineBtn.click({ force: true }).catch(() => {});
      await declineBtn.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
    }
  }

  /** Dismisses cookie banner + any modal overlay. */
  async dismissAllOverlays(): Promise<void> {
    await this.dismissCookies();

    // Session expired dialog (id="user-session-expired") on login page
    await this.dismissSessionExpiredDialog();

    // CP-specific dashboard dialogs — dismiss in priority order

    // 1. Dashboard Splash "dismiss" button  (id="dismiss")
    const splashDismiss = this.page.locator('#dismiss').first();
    if (await splashDismiss.isVisible().catch(() => false)) {
      await splashDismiss.click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(300);
    }

    // 2. KYC address reverification → click "Later" (id="kyc-address-later")
    const kycLater = this.page.locator('#kyc-address-later').first();
    if (await kycLater.isVisible().catch(() => false)) {
      await kycLater.click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(300);
    }

    // 3. Promotional dynamic dialog (id="promotional-dynamic-dialog")
    const promoDialog = this.page.locator('#promotional-dynamic-dialog').first();
    if (await promoDialog.isVisible().catch(() => false)) {
      const closeBtn = promoDialog.locator('button[aria-label*="close" i], button:has-text("×"), button:has-text("Close")').first();
      if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(300);
    }

    // 4. 2FA Setup promotional dialog — "Secure your account with two-step verification"
    //    Confirmed from Jam (fc7b4b3b): close button is id="close-2fa", text "Setup later".
    //    Dialog appears with a ~3-5s delay after login, so we wait briefly for it to render
    //    before checking — it won't always be there, so 3s timeout + catch is intentional.
    const setupLaterBtn = this.page
      .locator('#close-2fa, button:has-text("Setup later")')
      .first();
    const twoFaAppeared = await setupLaterBtn
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (twoFaAppeared) {
      await setupLaterBtn.click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(400);
    }

    // 5. Generic modal close
    const closeBtn = this.page
      .locator('[role="dialog"] button[aria-label*="close" i], [role="dialog"] button:has-text("×"), [role="dialog"] button:has-text("Close")')
      .first();
    const visible = await closeBtn.isVisible().catch(() => false);
    if (visible) await closeBtn.click({ force: true }).catch(() => {});
  }

  /**
   * Detects whether an API request fired (e.g. form was submitted to server
   * despite no visible client-side error). Useful when reCAPTCHA silently
   * absorbs validation responses.
   */
  async requestFired(selector = 'button:has([role="progressbar"])', timeout = 3_000): Promise<boolean> {
    return this.page
      .locator(selector)
      .waitFor({ state: 'visible', timeout })
      .then(() => true)
      .catch(() => false);
  }

  /**
   * Navigate to a section by label — uses direct URL routing.
   *
   * The CP sidebar items are <li id="menu-{key}"> elements (not <a>/<button>),
   * and several pages (Settings, Transactions, Wallet) are not in the sidebar at
   * all. Direct navigation is faster and more reliable than clicking sidebar items.
   *
   * URL map sourced from:
   *   - Sidebar.tsx  (sidebar item paths)
   *   - UserMenu.tsx / MobileMenu.tsx  (topbar dropdown paths)
   *   - CancelTransactionWizard.tsx, DashboardWizard.tsx  (/transactions)
   *   - Notifications.tsx  (/balance)
   */
  private static readonly NAV_PATHS: Record<string, string> = {
    // Sidebar items
    'dashboard':             '/dashboard',
    'send':                  '/money-transfer',
    'send money':            '/money-transfer',
    'money-transfer':        '/money-transfer',
    'money transfer':        '/money-transfer',
    'exchange':              '/exchange-currency',
    'exchange currency':     '/exchange-currency',
    'recipients':            '/recipients',
    'rewards':               '/rewards',
    'rates':                 '/rates',
    'schedule':              '/schedule-transaction',
    'schedule transaction':  '/schedule-transaction',
    // DTone / services (dynamic sidebar items)
    'top up':                '/mobile-top-up',
    'mobile':                '/mobile-top-up',
    'mobile top-up':         '/mobile-top-up',
    'gift card':             '/gift-card',
    'giftcard':              '/gift-card',
    'bill':                  '/international-bill',
    'bills':                 '/international-bill',
    'bill payment':          '/international-bill',
    'esim':                  '/e-sim',
    'e-sim':                 '/e-sim',
    // TopBar user-menu items (not in sidebar)
    'settings':              '/settings',
    'account':               '/account-details',
    'account details':       '/account-details',
    'verification':          '/verification-levels',
    'verification levels':   '/verification-levels',
    'inbox':                 '/resolution-centre',
    'resolution':            '/resolution-centre',
    'escalation':            '/resolution-centre',
    'help':                  '/customer-help',
    'help centre':           '/customer-help',
    // Pages accessed from dashboard / notifications
    'transactions':          '/transactions',
    'transaction':           '/transactions',
    'wallet':                '/balance',
    'balance':               '/balance',
    'cad balance':           '/balance',
    // Currency converter (public marketing page, also accessible logged in)
    'currency':              '/currency-converter',
    'currency converter':    '/currency-converter',
    'referral':              '/rewards',
  };

  /**
   * Navigate to a section by its common name.
   * Falls back to sidebar li click (id="menu-{key}") then text search if URL map misses.
   */
  async navigateSidebar(label: string): Promise<void> {
    const key = label.toLowerCase().trim();
    const path = FlowBase.NAV_PATHS[key];

    if (path) {
      await this.page.goto(ENV.BASE_URL + path);
      return;
    }

    // Fallback 1: sidebar li by id  (id="menu-{i18n_key}")
    const idSlug = key.replace(/\s+/g, '_');
    const byId = this.page.locator(`#menu-${idSlug}`).first();
    if (await byId.isVisible().catch(() => false)) {
      await byId.click();
      return;
    }

    // Fallback 2: any clickable element with matching text
    const item = this.page
      .locator('li, a, button, [role="menuitem"]')
      .filter({ hasText: new RegExp(label, 'i') })
      .first();
    await item.waitFor({ state: 'visible', timeout: 10_000 });
    await item.click();
  }
}
