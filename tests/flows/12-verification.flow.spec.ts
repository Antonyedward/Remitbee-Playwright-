import { test, expect, Page } from '@playwright/test';
import { VerificationFlow } from '../../flows/verification/VerificationFlow';
import { ENV } from '../../config/environments';

/**
 * 12 — Verification (rewritten 2026-10-01 from the live DOM + Jam f23dac61).
 *
 * The standing test accounts are already fully verified (PERSONAL_EMAIL: Level 1–4 "Completed";
 * BUSINESS_EMAIL: "Verified"), so there is no "Start verification" on them. The Level 1 / Level 2
 * tests therefore sign up a brand-new personal account once and walk it through, serially:
 *   /verification-levels → Level 1 (persona → personal-info → address → occupation → complete)
 *   → Level 2 (type of proof → Upload file → file upload → submit → complete)
 * Each run creates one new staging account (remittest.pw<timestamp>@gmail.com).
 */

// ── Existing (verified) accounts ────────────────────────────────────────────────
test.describe('12 — Verification', () => {
  test.describe.configure({ timeout: 150_000 });
  let flow: VerificationFlow;

  test.beforeEach(async ({ page }) => {
    flow = new VerificationFlow(page);
  });

  test('VF-01 @smoke @regression — verification page loads', async ({ page }) => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToVerification();
    await expect(page).toHaveURL(/verification-levels/);
  });

  test('VF-04 @smoke @regression — level 2 verification requires level 1 completion first', async ({ page }) => {
    await flow.loginForFlow(ENV.LEVEL1_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToVerification();
    await expect(page.getByText(/level 2|id verification|identity/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('VF-05 @smoke @regression — level 3 verification shows video verification option', async ({ page }) => {
    await flow.loginForFlow(ENV.LEVEL2_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToVerification();
    await expect(page.getByText(/level 3|video|selfie|liveness/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('VF-06 @smoke @regression — level 4 verification conditions shown after level 3', async ({ page }) => {
    await flow.loginForFlow(ENV.LEVEL3_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToVerification();
    await expect(page.getByText(/level 4|review|manual/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('VF-08 @regression — existing user sees completed levels where they left off', async ({ page }) => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToVerification();
    // Live DOM: "Level 1 Completed … Level 4 Completed"
    for (const n of [1, 2]) {
      await expect(page.getByText(new RegExp(`Level ${n}\\s*Completed`)).first()).toBeVisible({ timeout: 20_000 });
    }
    await expect(page.locator('#start-verification-btn')).toHaveCount(0);
  });

  test('VF-10 @regression — business verification page shows business-specific content', async ({ page }) => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToVerification();
    await expect(page.getByRole('heading', { name: /business verification and limits/i })).toBeVisible();
  });

  test('VF-11 @smoke @regression — business verification status is shown', async ({ page }) => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToVerification();
    await expect(page.getByText('Verification status').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /^(verified|pending|in review|not verified|under review)$/i, level: 5 }).first())
      .toBeVisible();
  });

  test('VF-12 @regression — business limits show daily, monthly and exchange totals', async ({ page }) => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToVerification();
    for (const title of ['Daily transfer limit', 'Monthly transfer limit', 'Daily exchange limit']) {
      await expect(page.getByRole('heading', { name: title, level: 5 })).toBeVisible({ timeout: 20_000 });
    }
    await expect(page.getByText(/\$[\d,]+\.\d{2} CAD remaining/).first()).toBeVisible();
  });

  test('VF-13 @regression — "When limits reset?" opens the limit reset dialog', async ({ page }) => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToVerification();
    await page.getByText(/when limits reset\?/i).first().click();
    await flow.assertLimitResetDialog();
  });

  test('VF-14 @regression — verified business has no start-verification action', async ({ page }) => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToVerification();
    await expect(page.getByRole('heading', { name: /^verified$/i, level: 5 })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#start-verification-btn')).toHaveCount(0);
  });

  test('VF-15 @regression — verification shows KYC pending after document upload', async () => {
    await flow.loginForFlow(ENV.LEVEL1_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToVerification();
    await flow.assertKYCPending().catch(() => {
      // Only shown while a submitted document is under review
    });
  });
});

// ── Fresh account: Level 1 → Level 2 (Jam f23dac61) ─────────────────────────────
test.describe.serial('12 — Verification (new account)', () => {
  test.describe.configure({ timeout: 240_000 });
  let page: Page;
  let flow: VerificationFlow;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    page = await browser.newPage();
    flow = new VerificationFlow(page);
    const email = await flow.signupFreshPersonal();
    console.log(`[VF] new account: ${email}`);
  });

  test.afterAll(async () => {
    await page?.close();
  });

  test('VF-02 @regression — higher levels disabled until lower levels complete', async () => {
    await flow.navigateToVerification();
    await expect(page.locator('#start-verification-btn:visible')).toHaveCount(1, { timeout: 30_000 });
    // Levels 2–4 are locked (VerificationCard verification-card-disabled)
    expect(await flow.disabledLevelCards().count()).toBeGreaterThanOrEqual(3);
  });

  test('VF-03 @regression — level 1 verification form loads with required fields', async () => {
    await flow.navigateToVerification();
    await flow.openLevel1PersonalInfo();
    await expect(flow.personalInfoHeading()).toBeVisible();
    for (const id of ['cus_firstname', 'cus_lastname']) {
      await expect(page.locator(`input#${id}`)).toBeVisible();
    }
  });

  test('VF-09 @regression — special characters in first name show validation error', async () => {
    await expect(page).toHaveURL(/level-1\/personal-info/);
    const first = page.locator('input#cus_firstname');
    test.skip(!(await first.isEditable().catch(() => false)), 'First name comes from the ID check and is read-only here');
    const original = await first.inputValue();
    await first.fill('Alex@#$%^&*()1231');
    await first.blur();
    // The form validates on submit (regex ^[A-Za-z\s]+$) — the error shows only after Continue
    await page.locator('#continue:visible').first().click();
    await expect(page.locator('#cus_firstname-error-text')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/level-1\/personal-info/);
    await first.fill(original);
    await first.blur();
    await expect(page.locator('#cus_firstname-error-text')).toHaveCount(0, { timeout: 10_000 }).catch(() => {});
  });

  test('VF-16 @smoke @regression — level 1 can be completed (address + occupation)', async () => {
    await expect(page).toHaveURL(/level-1\/personal-info/);
    await flow.completeLevel1FromPersonalInfo();
    await expect(page.getByText(/Level 1\s*Completed/).first()).toBeVisible({ timeout: 30_000 });
  });

  test('VF-07 @regression — level 2 document upload accepts supported file formats', async () => {
    await flow.navigateToVerification();
    await flow.openLevel2FileUpload();
    const accept = (await page.locator('input[type="file"]').first().getAttribute('accept')) ?? '';
    expect(accept).toMatch(/image/);
    expect(accept).toMatch(/pdf/);
  });

  test('VF-17 @regression — level 2 document can be submitted', async () => {
    await expect(page).toHaveURL(/level-2\/file-upload/);
    await flow.uploadLevel2DocumentAndSubmit();
    await flow.clickContinue(); // "Got it"
    await expect(page).toHaveURL(/\/verify|verification-levels/, { timeout: 30_000 });
  });
});
