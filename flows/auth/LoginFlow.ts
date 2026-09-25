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
    await this.page.goto(ENV.BASE_URL + '/login');
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
    const inputs = this.page.locator('input[maxlength="1"]');
    await inputs.first().waitFor({ state: 'visible' });
    for (let i = 0; i < otp.length; i++) {
      await inputs.nth(i).fill(otp[i]);
    }
  }

  async submitOTP(): Promise<void> {
    const btn = this.page.locator('button[type="submit"], button:has-text("Verify")').first();
    const visible = await btn.isVisible().catch(() => false);
    if (visible) await btn.click();
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
    const input = this.page.locator('input[type="email"], input[name="email"]').first();
    await input.waitFor({ state: 'visible' });
    await input.fill(email);
  }

  async submitForgotPassword(): Promise<void> {
    await this.page.locator('button[type="submit"]').first().click();
  }

  async assertResetEmailSent(): Promise<void> {
    const confirmation = this.page
      .locator('[class*="success"], [class*="Success"]')
      .or(this.page.getByText(/email sent|check your email|reset link/i))
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
    // Direct URL logout is the most reliable method in CP
    // ENV.LOGOUT_URL defaults to https://www.cp.wisecapitals.com/logout
    await this.page.goto(ENV.LOGOUT_URL || `${ENV.BASE_URL}/logout`);
    await this.page.waitForURL(/login/i, { timeout: 15_000 });
  }
}
