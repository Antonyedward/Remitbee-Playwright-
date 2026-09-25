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
    await this.page.goto(ENV.BASE_URL + '/login');

    // Dismiss cookie banner if present
    await this.dismissCookies();

    // CP login is a SINGLE-STEP form — both #email and #password are visible simultaneously.
    // Fill email first, then password, then click #save-changes ONCE.
    const emailInput = this.page.locator('#email, input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 15_000 });
    await emailInput.fill(email);

    const passwordInput = this.page.locator('#password, input[type="password"]').first();
    await passwordInput.waitFor({ state: 'visible', timeout: 10_000 });
    await passwordInput.fill(password);

    await this.page.locator('#save-changes').first().click();

    // OTP step — detect by input[maxlength="1"] (NOT text matching)
    // Some accounts / environments skip OTP entirely — treat as optional.
    const firstOtpDigit = this.page.locator('input[maxlength="1"]').first();
    const otpVisible = await firstOtpDigit
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (otpVisible) {
      // ENTER_OTP can be:
      //   - A 6-digit static code (e.g. '121212') → use directly
      //   - A Base32 TOTP secret (e.g. 'JBSWY3DPEHPK3PXP') → generate via authenticator
      const otpSecret = ENV.ENTER_OTP || '';
      const otp = /^\d{6}$/.test(otpSecret)
        ? otpSecret                          // static 6-digit code — use as-is
        : authenticator.generate(otpSecret); // Base32 TOTP secret — generate TOTP

      const otpInputs = this.page.locator('input[maxlength="1"]');
      for (let i = 0; i < otp.length; i++) {
        await otpInputs.nth(i).fill(otp[i]);
      }

      const verifyBtn = this.page
        .locator('#verify-code, button[type="submit"], button:has-text("Verify"), button:has-text("Confirm")')
        .first();
      const verifyVisible = await verifyBtn.isVisible().catch(() => false);
      if (verifyVisible) await verifyBtn.click();
    }

    // After login CP redirects to /dashboard (or /business-account/dashboard for business).
    // Accept any post-login URL that is not the login or OTP page.
    await this.page.waitForURL(
      url => !url.toString().includes('/login') && !url.toString().includes('/otp') && !url.toString().includes('/verify'),
      { timeout: 45_000 },
    );
    await this.dismissAllOverlays();
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

  /** Dismisses the cookie consent banner if it is visible. */
  async dismissCookies(): Promise<void> {
    const cookieDialog = this.page.locator('[class*="CookieDialog"], [class*="cookie-dialog"], [id*="cookie"]');
    const visible = await cookieDialog.first().isVisible().catch(() => false);
    if (!visible) return;

    const acceptBtn = this.page
      .locator('[class*="CookieDialog"] button, [class*="cookie"] button')
      .filter({ hasText: /accept|agree|ok|got it/i })
      .first();

    const btnVisible = await acceptBtn.isVisible().catch(() => false);
    if (btnVisible) {
      await acceptBtn.click({ force: true });
      await cookieDialog.first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
    }
  }

  /** Dismisses cookie banner + any modal overlay. */
  async dismissAllOverlays(): Promise<void> {
    await this.dismissCookies();

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

    // 4. Generic modal close
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
