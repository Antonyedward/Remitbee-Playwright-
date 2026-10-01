import { Page, expect } from '@playwright/test';
import { authenticator } from 'otplib';
import { FlowBase } from '../FlowBase';
import { ENV } from '../../config/environments';
import { triggerPasswordResetLink } from '../../utils/api-utils';

export class LoginFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  async navigateToLogin(): Promise<void> {
    // Use 'domcontentloaded' instead of the default 'load' so 3rd-party resources
    // (reCAPTCHA, analytics iframes) can't stall the navigation and cause a 30s timeout.
    // The login form is ready as soon as the DOM is parsed.
    await this.page.goto(ENV.BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await this.dismissCookies();
  }

  async fillEmail(email: string): Promise<void> {
    const input = this.page.locator('#email, input[type="email"]').first();
    await input.waitFor({ state: 'visible' });
    await input.fill(email);
  }

  async submitEmail(): Promise<void> {
    // CP login uses id="save-changes" for the Continue button on the email step
    await this.page.locator('#save-changes').first().click();
  }

  async fillPassword(password: string): Promise<void> {
    const input = this.page.locator('#password, input[type="password"]').first();
    await input.waitFor({ state: 'visible' });
    await input.fill(password);
  }

  async submitPassword(): Promise<void> {
    // CP login reuses id="save-changes" for the Sign In button on the password step
    await this.page.locator('#save-changes').first().click();
  }

  async fillOTP(secret: string = ENV.ENTER_OTP): Promise<void> {
    // secret can be a 6-digit static code OR a Base32 TOTP secret
    const otp = /^\d{6}$/.test(secret)
      ? secret                          // static 6-digit code — use as-is
      : authenticator.generate(secret); // Base32 TOTP secret — compute TOTP
    // CP CodeVerificationInput renders id="code-1" through id="code-6"
    await this.page.locator('#code-1').waitFor({ state: 'visible', timeout: 10_000 });
    for (let i = 0; i < otp.length; i++) {
      const digitInput = this.page.locator(`#code-${i + 1}`);
      await digitInput.fill(otp[i]);
      await this.page.waitForTimeout(30); // brief pause for React state update
    }
  }

  async submitOTP(): Promise<void> {
    // Login OTP: id="verify_code" (underscore) in VerificationCodeScreen.tsx
    // Signup/2FA: id="verify-code" (dash) in 2FAVerification.tsx
    const btn = this.page.locator('#verify_code, #verify-code').first();
    const visible = await btn.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
    if (visible) await btn.click({ force: true });
  }

  async assertDashboard(): Promise<void> {
    await this.page.waitForURL(/\/(dashboard|home)/i, { timeout: 30_000 });
  }

  async assertLoginError(pattern: RegExp): Promise<void> {
    // CP Alert component renders the error message in id="message" div (rb-text child)
    // Also checks class-based error elements as fallback
    const errorEl = this.page
      .locator('#message, [class*="rb-alert"], [class*="error"], [class*="Error"]')
      .filter({ hasText: pattern })
      .first();
    await errorEl.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(errorEl).toBeVisible();
  }

  async clickForgotPassword(): Promise<void> {
    // CP uses id="forgot-password" for the Forgot Password link
    await this.page.locator('#forgot-password').first().click();
  }

  async assertForgotPasswordPage(): Promise<void> {
    await this.page.waitForURL(/forgot/i, { timeout: 10_000 });
  }

  async fillForgotPasswordEmail(email: string): Promise<void> {
    // ForgotPassword.tsx: <Input id='email'> (type text, prefilled from the login step)
    const input = this.page.locator('input#email:visible').first();
    await input.waitFor({ state: 'visible' });
    await input.fill(email);
  }

  async submitForgotPassword(): Promise<void> {
    // "Send reset link" = #send_reset_link ("Back to login" is the type=submit button)
    await this.page.locator('#send_reset_link:visible').first().click();
  }

  async assertResetEmailSent(): Promise<void> {
    const confirmation = this.page
      .locator('[class*="success"], [class*="Success"]')
      .or(this.page.getByText(/check your email|we sent a link to|email sent/i))
      .first();
    await confirmation.waitFor({ state: 'visible', timeout: 15_000 });
  }

  async assertForgotSMSFired(): Promise<void> {
    const notFound = this.page
      .getByText(/phone.*not found|couldn't find|unable to send|something went wrong/i)
      .first();
    const requestFired = await this.requestFired();
    if (!requestFired) {
      await notFound.waitFor({ state: 'visible', timeout: 10_000 });
    }
  }

  async triggerPasswordReset(email?: string): Promise<void> {
    await triggerPasswordResetLink(email);
  }

  async clickSignUp(): Promise<void> {
    // CP uses id="signup" for the Sign Up link on the login page
    await this.page.locator('#signup').first().click();
  }

  async assertSignUpPage(): Promise<void> {
    await this.page.waitForURL(/sign-?up|register/i, { timeout: 10_000 });
  }

  async logout(): Promise<void> {
    // Navigate to logout URL; CP may redirect to landing page or login depending on env.
    // After any navigation settles, force-navigate to /login to ensure we end on the login page.
    try {
      await this.page.goto(ENV.LOGOUT_URL || `${ENV.BASE_URL}/logout`, {
        waitUntil: 'domcontentloaded',
        timeout: 15_000,
      });
    } catch {
      // Navigation may time out on logout redirect chains — that's OK
    }
    // If we're not on login already, navigate there explicitly
    if (!/\/login/.test(this.page.url())) {
      await this.page.goto(`${ENV.BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    }
    await this.page.waitForURL(/login/i, { timeout: 10_000 });
  }
}
