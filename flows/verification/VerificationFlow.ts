import { Page, Locator, expect } from '@playwright/test';
import path from 'path';
import { FlowBase } from '../FlowBase';
import { ENV } from '../../config/environments';

export class VerificationFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  /**
   * /verification-levels (VerificationLevelsWizard / VerificationLevelsBusinessWizard).
   * Personal: "Verification levels" cards (VerificationCard.tsx) — status "Completed", locked cards carry
   * class verification-card-disabled, the next level shows #start-verification-btn.
   * Business: "Business verification and limits" — status + limit cards.
   */
  async navigateToVerification(): Promise<void> {
    await this.page.goto(ENV.BASE_URL + '/verification-levels', { waitUntil: 'domcontentloaded' });
    await this.page.waitForURL(/verification-levels/i, { timeout: 30_000 });
    await this.dismissAllOverlays();
    await expect(this.page.getByRole('heading', { name: /verification levels|business verification/i }))
      .toBeVisible({ timeout: 45_000 });
  }

  levelCards(): Locator {
    return this.page.locator('[class*="verification-card"]:not([class*="verification-card-"])');
  }

  disabledLevelCards(): Locator {
    return this.page.locator('[class*="verification-card-disabled"]');
  }

  // ── Fresh account (Jam f23dac61) ────────────────────────────────────────────

  /**
   * Sign up a brand-new personal account and land on the dashboard:
   * /signup (email + password, #sign-up) → step 2 phone (#cus_phone1, #send-code)
   * → code (#code-1..6, #verify_code) → /choose-account-type (#personal)
   * → /choose-interested-currency (#close-icon) → /dashboard.
   * Returns the new email.
   */
  async signupFreshPersonal(): Promise<string> {
    // Staging sometimes leaves the signup spinner hanging forever after #sign-up — reload and
    // retry with a fresh email (up to 3 attempts) instead of failing the whole serial group.
    let email = '';
    for (let attempt = 1; ; attempt++) {
      email = `remittest.pw${Date.now()}@gmail.com`;
      await this.page.goto(ENV.BASE_URL + '/signup', { waitUntil: 'domcontentloaded' });
      await this.dismissCookies();
      await this.page.locator('#email').fill(email);
      await this.page.locator('#password').fill(ENV.USER_PASSWORD);
      await expect(this.page.locator('#sign-up')).toBeEnabled({ timeout: 15_000 });
      await this.page.locator('#sign-up').click();
      const ok = await this.page.waitForURL(/signup\?step=2|phone/i, { timeout: 40_000 })
        .then(() => true).catch(() => false);
      if (ok) break;
      console.log(`[VF] signup attempt ${attempt} hung on ${this.page.url()} — retrying`);
      if (attempt >= 3) throw new Error(`Signup did not reach the phone step after ${attempt} attempts`);
    }

    // Phone numbers must be unique per account — random Toronto number, retry on "already exists"
    for (let attempt = 0; attempt < 3; attempt++) {
      const phone = `416${String(2000000 + Math.floor(Math.random() * 7999999)).padStart(7, '0')}`;
      const input = this.page.locator('input#cus_phone1');
      await input.waitFor({ state: 'visible', timeout: 20_000 });
      await input.fill('');
      await input.pressSequentially(phone, { delay: 20 });
      await this.page.locator('#send-code').click();
      const code1 = this.page.locator('#code-1');
      const exists = this.page.locator('#phone-already-exists-dialog');
      await code1.or(exists).first().waitFor({ state: 'visible', timeout: 30_000 });
      if (await code1.isVisible()) break;
      await exists.locator('#dialog-button-secondaryAction, #dialog-button-primaryAction').first().click().catch(() => {});
    }
    const otp = ENV.ENTER_OTP;
    for (let i = 0; i < otp.length; i++) await this.page.locator(`#code-${i + 1}`).fill(otp[i]);
    const verify = this.page.locator('#verify_code, #verify-code').first();
    await expect(verify).toBeEnabled({ timeout: 10_000 });
    await verify.click();

    await this.page.waitForURL(/choose-account-type/, { timeout: 45_000 });
    await this.page.locator('#personal').click();
    await this.page.waitForURL(/choose-interested-currency|dashboard/, { timeout: 30_000 });
    if (/choose-interested-currency/.test(this.page.url())) {
      await this.page.locator('#close-icon').click();
    }
    await this.page.waitForURL(/dashboard/, { timeout: 45_000 });
    await this.dismissAllOverlays();
    await this.page.locator('#close-2fa').click({ timeout: 5_000 }).catch(() => {}); // "Setup later"
    return email;
  }

  /** From /verification-levels: the next level's "Start verification" → splash → "Start verification". */
  async startNextLevel(level: 1 | 2): Promise<void> {
    await this.page.locator('#start-verification-btn:visible').first().click();
    await this.page.waitForURL(new RegExp(`/verify/level-${level}`), { timeout: 30_000 });
    // Splash "Start verification" (#start-verification): the first click is often swallowed while the
    // page hydrates — retry until the URL leaves start-level-N.
    await this.page.waitForURL(new RegExp(`start-level-${level}`), { timeout: 30_000 }).catch(() => {});
    const splashStart = this.page.locator('#start-verification');
    await expect(async () => {
      if (!new RegExp(`start-level-${level}`).test(this.page.url())) return;
      await expect(splashStart).toBeEnabled({ timeout: 5_000 });
      await splashStart.click();
      await expect.poll(() => this.page.url(), { timeout: 8_000 }).not.toMatch(new RegExp(`start-level-${level}`));
    }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 3_000] });
  }

  // Persona sandbox rejected a generated PNG ("Error 422 … try a different image"); the dummy PDF supplied
  // by QA is tried first, the PNG only as a fallback.
  static readonly SAMPLE_ID_FILES = [
    path.resolve(__dirname, '../../test-data/verification/sample-id-doc.pdf'),
    path.resolve(__dirname, '../../test-data/verification/sample-id.png'),
  ];

  /**
   * /verify/level-1/persona opens the Persona SANDBOX in a dialog iframe ("Pass verifications" is on,
   * so any photo passes). Jam f23dac61: Begin verifying → pick "Provincial ID" → Upload a photo →
   * Use this photo → "We are processing your ID" → app continues to /verify/level-1/personal-info.
   * Screens are handled in whatever order they appear (Persona can resume mid-flow).
   */
  async completePersonaSandbox(): Promise<void> {
    const frame = this.page.frameLocator('[role="dialog"] iframe').first();
    const done = () => /level-1\/(personal-info|address|occupation|level-1-complete)/.test(this.page.url());
    const deadline = Date.now() + 150_000;
    let fileIdx = 0;
    while (!done() && Date.now() < deadline) {
      // Upload rejected ("We detected an error with your submission … (Error 422)") → next sample file
      const rejected = frame.getByText(/detected an error with your submission/i).first();
      if (await rejected.isVisible().catch(() => false)) {
        fileIdx = Math.min(fileIdx + 1, VerificationFlow.SAMPLE_ID_FILES.length - 1);
        await frame.getByRole('button', { name: /close notification/i }).first().click().catch(() => {});
      }
      const btn = (name: RegExp) => frame.getByRole('button', { name }).first();
      const begin = btn(/begin verifying/i);
      const idType = btn(/provincial id|driver'?s? licen[sc]e/i);
      const upload = btn(/upload a (photo|file)/i);
      const usePhoto = btn(/use this (photo|file)|submit|confirm/i);
      const selectCountry = btn(/^select$/i);                 // "What country is your government ID from?" (Canada preselected)
      const genericNext = btn(/^(continue|next|get started)$/i);
      const closeBanner = frame.getByRole('alert').getByRole('button', { name: /^close$/i }).first(); // sandbox notice
      if (await closeBanner.isVisible().catch(() => false)) {
        await closeBanner.click().catch(() => {});
      }
      if (await selectCountry.isVisible().catch(() => false)) {
        await selectCountry.click();
      } else if (await usePhoto.isVisible().catch(() => false)) {
        await usePhoto.click({ timeout: 8_000 }).catch(() => {}); // button re-renders while the image loads
      } else if (await upload.isVisible().catch(() => false)) {
        const [chooser] = await Promise.all([this.page.waitForEvent('filechooser', { timeout: 15_000 }), upload.click()]);
        await chooser.setFiles(VerificationFlow.SAMPLE_ID_FILES[fileIdx]);
      } else if (await begin.isVisible().catch(() => false)) {
        await begin.click();
      } else if (await idType.isVisible().catch(() => false)) {
        await idType.click();
      } else if (await genericNext.isVisible().catch(() => false)) {
        await genericNext.click();
      }
      await this.page.waitForTimeout(1_500);
    }
    if (!done()) throw new Error(`Persona sandbox did not finish (still on ${this.page.url()})`);
  }

  personalInfoHeading(): Locator {
    return this.page.getByRole('heading', { name: /tell us more about yourself/i });
  }

  /** Level 1 → Persona sandbox ID check → personal-info form. */
  async openLevel1PersonalInfo(): Promise<void> {
    await this.startNextLevel(1);
    await this.page.waitForURL(/level-1\/(persona|personal-info)/, { timeout: 45_000 });
    if (/level-1\/persona/.test(this.page.url())) await this.completePersonaSandbox();
    await this.page.waitForURL(/level-1\/personal-info/, { timeout: 60_000 });
    // "Tell us more about yourself" — First name / Last name / Date of birth prefilled from the ID check
    await expect(this.personalInfoHeading()).toBeVisible({ timeout: 30_000 });
    await expect(this.page.locator('input#cus_firstname')).toBeVisible({ timeout: 30_000 });
  }

  async clickContinue(): Promise<void> {
    const btn = this.page.locator('#continue:visible').first();
    await expect(btn).toBeEnabled({ timeout: 20_000 });
    await btn.click();
  }

  /** personal-info → address → occupation → level-1-complete → back to /verification-levels. */
  async completeLevel1FromPersonalInfo(): Promise<void> {
    await this.clickContinue();
    await this.page.waitForURL(/level-1\/address/, { timeout: 30_000 });

    // Address autocomplete: type, then pick the suggestion (suggestion div id = full address)
    const addr = this.page.locator('input#cus_address1');
    await addr.waitFor({ state: 'visible', timeout: 20_000 });
    await addr.fill('');
    await addr.pressSequentially('438 University Avenue', { delay: 40 });
    const suggestion = this.page.locator('[id*="University Avenue"]:visible')
      .or(this.page.getByText(/438 University Avenue, Toronto/i)).first();
    const picked = await suggestion.click({ timeout: 15_000 }).then(() => true).catch(() => false);
    if (!picked) {
      // Autocomplete sometimes answers "No results found" (seen live) — fill the address fields by hand
      await addr.fill('438 University Avenue');
      await this.page.keyboard.press('Escape').catch(() => {});
      await this.page.locator('input#cus_city').fill('Toronto');
      await this.page.locator('input#cus_postal').fill('M5G 2K8');
      const province = this.page.locator('button#cus_province, [id="cus_province"] button').first();
      await expect(async () => {
        const opt = this.page.locator('li[data-item]:visible').filter({ hasText: /^\s*Ontario/ }).first();
        if (!(await opt.isVisible().catch(() => false))) await province.click();
        await opt.click({ timeout: 5_000 });
        await expect(province).toContainText(/Ontario/, { timeout: 3_000 });
      }).toPass({ timeout: 25_000, intervals: [500, 1_000] });
    }
    await expect(this.page.locator('input#cus_city')).not.toHaveValue('', { timeout: 15_000 });
    await this.clickContinue();
    await this.page.waitForURL(/level-1\/occupation/, { timeout: 30_000 });

    // Occupation dropdown → first option
    await expect(async () => {
      const item = this.page.locator('li[data-item]:visible').first();
      if (!(await item.isVisible().catch(() => false))) {
        await this.page.locator('[class*="rb-dropdown-field"]:visible').first().click();
      }
      await item.click({ timeout: 5_000 });
    }).toPass({ timeout: 25_000, intervals: [500, 1_000] });
    await this.clickContinue();
    await this.page.waitForURL(/level-1-complete/, { timeout: 45_000 });
    await this.clickContinue();
    await this.page.waitForURL(/verification-levels/, { timeout: 45_000 });
  }

  /** Level 2 → type-proof (first document type) → upload-method ("Upload file") → file-upload. */
  async openLevel2FileUpload(): Promise<void> {
    await this.startNextLevel(2);
    await this.page.waitForURL(/level-2\/type-proof/, { timeout: 45_000 });
    await this.page.locator('[id="0"]:visible').first().click();
    await this.clickContinue();
    await this.page.waitForURL(/level-2\/upload-method/, { timeout: 30_000 });
    await this.page.getByText('Upload file', { exact: true }).first().click();
    await this.page.waitForURL(/level-2\/file-upload/, { timeout: 30_000 });
    await expect(this.page.locator('#choose-file')).toBeVisible({ timeout: 20_000 });
  }

  static readonly SAMPLE_DOC = path.resolve(__dirname, '../../test-data/verification/sample-id-doc.pdf');

  async uploadLevel2DocumentAndSubmit(): Promise<void> {
    await this.page.locator('input[type="file"]').first().setInputFiles(VerificationFlow.SAMPLE_DOC);
    await expect(this.page.locator('#invalid-file-alert')).toHaveCount(0);
    await this.clickContinue(); // "Submit"
    await this.page.waitForURL(/level-2-complete/, { timeout: 60_000 });
  }

  async assertVerificationStatus(status: string): Promise<void> {
    const statusEl = this.page
      .locator('[class*="status"], [class*="Status"]')
      .filter({ hasText: new RegExp(status, 'i') })
      .first();
    await statusEl.waitFor({ state: 'visible' });
    await expect(statusEl).toBeVisible();
  }

  async clickStartVerification(): Promise<void> {
    // CP uses id="start-verification-btn" or id="increase-limits-btn" for the start CTA
    const btn = this.page
      .locator('#start-verification-btn, #increase-limits-btn')
      .first();
    const found = await btn.isVisible().catch(() => false);
    if (found) {
      await btn.click({ force: true });
    } else {
      await this.page
        .locator('button:has-text("Start"), button:has-text("Verify now")')
        .first()
        .click();
    }
  }


  async clickRetry(): Promise<void> {
    await this.page.locator('#retry').first().click({ force: true });
  }

  async assertLevel4Dialog(): Promise<void> {
    await expect(this.page.locator('#level-4-dialog').first()).toBeVisible({ timeout: 10_000 });
  }

  async assertLimitResetDialog(): Promise<void> {
    await expect(this.page.locator('#limit-reset-dialog').first()).toBeVisible({ timeout: 10_000 });
  }

  async uploadDocument(docType: string, filePath: string): Promise<void> {
    const docBtn = this.page
      .locator('[class*="document"], [class*="Document"]')
      .filter({ hasText: new RegExp(docType, 'i') })
      .first();
    await docBtn.click({ force: true });

    const fileInput = this.page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(filePath);
  }

  async assertDocumentUploaded(): Promise<void> {
    const uploaded = this.page
      .locator('[class*="uploaded"], [class*="Uploaded"]')
      .or(this.page.getByText(/uploaded|submitted/i))
      .first();
    await uploaded.waitFor({ state: 'visible', timeout: 15_000 });
  }

  async selectDocumentType(type: string): Promise<void> {
    const typeBtn = this.page
      .locator('[class*="doc-type"], [class*="DocType"]')
      .filter({ hasText: new RegExp(type, 'i') })
      .or(this.page.locator('select[name*="type"]'))
      .first();
    await typeBtn.click({ force: true });
  }

  async assertKYCPending(): Promise<void> {
    const pending = this.page
      .getByText(/pending|under review|processing/i)
      .first();
    await pending.waitFor({ state: 'visible' });
    await expect(pending).toBeVisible();
  }
}
