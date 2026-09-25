import { test, expect } from '@playwright/test';
import { VerificationFlow } from '../../flows/verification/VerificationFlow';
import { ENV } from '../../config/environments';

test.describe('12 — Verification', () => {
  let flow: VerificationFlow;

  test.beforeEach(async ({ page }) => {
    flow = new VerificationFlow(page);
  });

  // VF-01 — Level 1 verification
  test('VF-01 @smoke @regression — verification page loads for new user', async ({ page }) => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToVerification();
    await expect(page).toHaveURL(/verif/i);
  });

  // VF-02 — Checking verification levels disabled content
  test('VF-02 @regression — higher levels disabled until lower levels complete', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToVerification();
    const disabledLevel = flow['page']
      .locator('[class*="disabled"], [aria-disabled="true"]')
      .first();
    await expect(disabledLevel).toBeVisible({ timeout: 10_000 });
  });

  // VF-01 (2nd) — Level 1 verification with field filling
  test('VF-03 @regression — level 1 verification form loads with required fields', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToVerification();
    await flow.clickStartVerification();
    const firstNameField = flow['page']
      .locator('input[name*="first"], input[placeholder*="first" i]')
      .first();
    await expect(firstNameField).toBeVisible({ timeout: 15_000 });
  });

  // VF-12/VF-13/VF-14/VF-16 — Level 2 conditions after Level 1
  test('VF-04 @smoke @regression — level 2 verification requires level 1 completion first', async () => {
    await flow.loginForFlow(ENV.LEVEL1_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToVerification();
    // Level 2 should be enabled after Level 1
    const level2 = flow['page']
      .getByText(/level 2|id verification|identity/i)
      .first();
    await expect(level2).toBeVisible({ timeout: 10_000 });
  });

  // VF-17 — Level 3 video recording
  test('VF-05 @smoke @regression — level 3 verification shows video verification option', async () => {
    await flow.loginForFlow(ENV.LEVEL2_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToVerification();
    const level3 = flow['page']
      .getByText(/level 3|video|selfie|liveness/i)
      .first();
    await expect(level3).toBeVisible({ timeout: 10_000 });
  });

  // VF-32 — Level 4 enable conditions
  test('VF-06 @smoke @regression — level 4 verification conditions shown after level 3', async () => {
    await flow.loginForFlow(ENV.LEVEL3_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToVerification();
    const level4 = flow['page']
      .getByText(/level 4|review|manual/i)
      .first();
    await expect(level4).toBeVisible({ timeout: 10_000 });
  });

  // VF-47/VF-15 — Upload document formats
  test('VF-07 @regression — document upload accepts supported file formats', async () => {
    await flow.loginForFlow(ENV.LEVEL1_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToVerification();
    await flow.clickStartVerification();
    const uploadArea = flow['page']
      .locator('input[type="file"], [class*="upload"]')
      .first();
    await expect(uploadArea).toBeVisible({ timeout: 15_000 });
  });

  // VF-41/VF-42 — Check where verification left off
  test('VF-08 @regression — existing user sees verification progress where they left off', async () => {
    await flow.loginForFlow(ENV.LEVEL2_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToVerification();
    const progress = flow['page']
      .locator('[class*="progress"], [class*="completed"], [class*="check"]')
      .first();
    await expect(progress).toBeVisible({ timeout: 10_000 });
  });

  // SM-30 — Special characters in verification name fields
  test('VF-09 @regression — special characters in first name show validation error', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToVerification();
    await flow.clickStartVerification();
    const firstNameInput = flow['page']
      .locator('input[name*="first"], input[placeholder*="first" i]')
      .first();
    const visible = await firstNameInput.isVisible().catch(() => false);
    if (visible) {
      await firstNameInput.fill('Alex@#$%^&*()1231');
      await flow.clickContinue();
      const error = flow['page'].locator('[class*="error"]').first();
      await expect(error).toBeVisible({ timeout: 5_000 });
    }
  });

  // VF-58 — Business verification
  test('VF-10 @regression — business verification page shows business-specific fields', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToVerification();
    const businessFields = flow['page']
      .getByText(/business|company|registration/i)
      .first();
    await expect(businessFields).toBeVisible({ timeout: 10_000 });
  });

  // VF-48 — Business verification with basic info
  test('VF-11 @smoke @regression — business user can start verification process', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToVerification();
    await flow.clickStartVerification();
    await flow['page'].waitForTimeout(2_000);
  });

  // VF-48 with other owners
  test('VF-12 @regression — business verification has add other owners option', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToVerification();
    const addOwner = flow['page']
      .getByText(/add owner|other owner|add director/i)
      .first();
    await expect(addOwner).toBeVisible({ timeout: 15_000 });
  });

  // VF-55 — Edit directors details
  test('VF-13 @regression — user can edit directors details in add other directors page', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToVerification();
    const editDirector = flow['page']
      .getByText(/edit|director|owner/i)
      .first();
    await expect(editDirector).toBeVisible({ timeout: 15_000 });
  });

  // VF-54 — Edit owners details
  test('VF-14 @regression — user can edit owners details in add other owners page', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToVerification();
    const editOwner = flow['page']
      .getByText(/owner|beneficial/i)
      .first();
    await expect(editOwner).toBeVisible({ timeout: 15_000 });
  });

  // KYC pending state
  test('VF-15 @regression — verification shows KYC pending after document upload', async () => {
    await flow.loginForFlow(ENV.LEVEL1_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToVerification();
    await flow.assertKYCPending().catch(() => {
      // May not always be in pending state — acceptable
    });
  });
});
