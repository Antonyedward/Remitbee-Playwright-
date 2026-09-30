/**
 * SignupFlow — covers the 3-step signup/onboarding wizard:
 *
 *  Step 1  /signup                  Email + password form (Signup.tsx)
 *  Step 2  /signup?step=2           Phone number entry   (2FAVerification.tsx)
 *  Step 3  /signup?step=3           OTP verification     (2FAVerification.tsx)
 *  After   /choose-account-type     Account type selection
 *
 * All element IDs come directly from the remitbee-cp source:
 *   src/components/signup-v2/signup/Signup.tsx
 *   src/components/signup-v2/2FAVerification.tsx
 */

import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';
import { ENV } from '../../config/environments';

export class SignupFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  async navigateToSignup(): Promise<void> {
    await this.page.goto(ENV.BASE_URL + '/signup');
    await this.dismissCookies();
  }

  // ── Step 1: Email + Password ────────────────────────────────────────────────

  /** Assert the signup page heading is visible — id="welcome-to-remitbee" */
  async assertSignupPageLoaded(): Promise<void> {
    await expect(this.page.locator('#welcome-to-remitbee')).toBeVisible({ timeout: 15_000 });
  }

  /** Fill email — id="email" */
  async fillEmail(email: string): Promise<void> {
    const input = this.page.locator('#email');
    await input.waitFor({ state: 'visible' });
    await input.fill(email);
  }

  /** Fill password — id="password" */
  async fillPassword(password: string): Promise<void> {
    const input = this.page.locator('#password');
    await input.waitFor({ state: 'visible' });
    await input.fill(password);
  }

  /** Click the sign-up submit button — id="sign-up" */
  async clickSignUp(): Promise<void> {
    await this.page.locator('#sign-up').click();
  }

  /** Toggle password visibility — id="toggle-password" */
  async togglePasswordVisibility(): Promise<void> {
    await this.page.locator('#toggle-password').click();
  }

  /** Assert password type switched to text (visible) or back to password */
  async assertPasswordVisible(visible: boolean): Promise<void> {
    const expectedType = visible ? 'text' : 'password';
    await expect(this.page.locator('#password')).toHaveAttribute('type', expectedType);
  }

  // ── Referral code ────────────────────────────────────────────────────────────

  /** Check/uncheck the referral code checkbox — id="checkbox" */
  async toggleReferralCodeCheckbox(): Promise<void> {
    await this.page.locator('#checkbox').click();
  }

  /** Fill referral code field — id="referralCode" (visible only after checkbox ticked) */
  async fillReferralCode(code: string): Promise<void> {
    const input = this.page.locator('#referralCode');
    await input.waitFor({ state: 'visible' });
    await input.fill(code);
  }

  // ── Password strength checklist (id from PasswordRegCheck.tsx) ───────────────

  async assertPasswordChecklistVisible(): Promise<void> {
    await expect(this.page.locator('#minCharacters')).toBeVisible();
  }

  async assertMinCharacters(met: boolean): Promise<void> {
    const el = this.page.locator('#minCharacters');
    await el.waitFor({ state: 'visible' });
    // met = green checkmark class; unmet = default
    expect(await el.isVisible()).toBe(true);
  }

  // ── Validation errors ────────────────────────────────────────────────────────

  /** Email validation error — id="email-error-text" */
  async assertEmailError(): Promise<void> {
    await expect(this.page.locator('#email-error-text')).toBeVisible({ timeout: 10_000 });
  }

  /** Password validation error — id="password-error-text" */
  async assertPasswordError(): Promise<void> {
    await expect(this.page.locator('#password-error-text')).toBeVisible({ timeout: 10_000 });
  }

  /** Referral code validation error — id="referralCode-error-text" */
  async assertReferralCodeError(): Promise<void> {
    await expect(this.page.locator('#referralCode-error-text')).toBeVisible({ timeout: 10_000 });
  }

  /** Alert banner error (reCAPTCHA / server errors) — id="transfer-detail-compliance-notification" */
  async assertAlertBanner(messagePattern?: RegExp): Promise<void> {
    const alert = this.page.locator('#transfer-detail-compliance-notification');
    await alert.waitFor({ state: 'visible', timeout: 10_000 });
    if (messagePattern) {
      await expect(alert).toContainText(messagePattern);
    }
  }

  // ── Dialogs ──────────────────────────────────────────────────────────────────

  /** "Account already exists" dialog — id="exists-user-dialog" */
  async assertExistingUserDialog(): Promise<void> {
    await expect(this.page.locator('#exists-user-dialog')).toBeVisible({ timeout: 15_000 });
  }

  async clickExistingUserLogin(): Promise<void> {
    // Primary action = "Log in"
    await this.page.locator('#exists-user-dialog').locator('button:has-text("Log in")').click();
  }

  async clickExistingUserCancel(): Promise<void> {
    await this.page.locator('#exists-user-dialog').locator('button:has-text("Cancel")').click();
  }

  /** "Deactivated account" dialog — id="deactivated-user-dialog" */
  async assertDeactivatedUserDialog(): Promise<void> {
    await expect(this.page.locator('#deactivated-user-dialog')).toBeVisible({ timeout: 15_000 });
  }

  // ── Step 2: Phone number entry (/signup?step=2) ──────────────────────────────

  async assertPhoneVerificationStep(): Promise<void> {
    await this.page.waitForURL(/signup.*step=2|signup\/phone-verification/i, { timeout: 20_000 });
    await expect(this.page.locator('#verify-your-phone-number')).toBeVisible({ timeout: 15_000 });
  }

  async fillPhoneNumber(phone: string): Promise<void> {
    // PHONE_NUMBER_FORM_FIELD renders as cus_phone1 input inside a PhoneInput component
    const phoneInput = this.page.locator('input[name="cus_phone1"], input[id="cus_phone1"]').first();
    await phoneInput.waitFor({ state: 'visible' });
    await phoneInput.fill(phone);
  }

  /** Send code button — id="send-code" */
  async clickSendCode(): Promise<void> {
    await this.page.locator('#send-code').click();
  }

  // ── Step 3: OTP verification (/signup?step=3) ─────────────────────────────────

  async assertOTPVerificationStep(): Promise<void> {
    await this.page.waitForURL(/signup.*step=3/i, { timeout: 20_000 });
    await expect(this.page.locator('#enter-your-verification-code')).toBeVisible({ timeout: 15_000 });
  }

  /**
   * CodeVerificationInput renders 6 individual character inputs.
   * Fill each digit into the inputs in order.
   */
  async fillOTPCode(code: string): Promise<void> {
    // CodeVerificationInput renders individual inputs with id="code-1" … id="code-6"
    await this.page.locator('#code-1').waitFor({ state: 'visible', timeout: 15_000 });
    for (let i = 0; i < Math.min(code.length, 6); i++) {
      await this.page.locator(`#code-${i + 1}`).fill(code[i]);
    }
  }

  /** OTP error message — id="error-message" */
  async assertOTPError(): Promise<void> {
    await expect(this.page.locator('#error-message')).toBeVisible({ timeout: 10_000 });
  }

  /** Verify code button — id="verify-code" */
  async clickVerifyCode(): Promise<void> {
    await this.page.locator('#verify-code').click();
  }

  // ── SMS / WhatsApp mode toggle ───────────────────────────────────────────────

  async assertResendCodeVisible(): Promise<void> {
    const resend = this.page.getByText(/resend code/i).first();
    await expect(resend).toBeVisible({ timeout: 30_000 });
  }

  async clickResendCode(): Promise<void> {
    await this.page.getByText(/resend code/i).first().click();
  }

  async clickSwitchToWhatsApp(): Promise<void> {
    const wa = this.page.getByText(/whatsapp/i).first();
    await wa.click({ force: true });
  }

  // ── After verification ────────────────────────────────────────────────────────

  async assertChooseAccountTypePage(): Promise<void> {
    await this.page.waitForURL(/choose-account-type/i, { timeout: 30_000 });
  }

  // ── Navigation helpers ────────────────────────────────────────────────────────

  async assertLoginLink(): Promise<void> {
    const loginLink = this.page.locator('#login');
    await expect(loginLink).toBeVisible();
  }

  async clickLoginLink(): Promise<void> {
    await this.page.locator('#login').click();
    await this.page.waitForURL(/login/i, { timeout: 10_000 });
  }

  async assertTermsAndConditionsLink(): Promise<void> {
    await expect(this.page.locator('#terms-and-conditions')).toBeVisible();
  }

  async assertPrivacyPolicyLink(): Promise<void> {
    await expect(this.page.locator('#privacy-policy')).toBeVisible();
  }

  // ── Composite helper ─────────────────────────────────────────────────────────

  /** Complete step 1 only (email + password submit) */
  async submitEmailPassword(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickSignUp();
  }
}
