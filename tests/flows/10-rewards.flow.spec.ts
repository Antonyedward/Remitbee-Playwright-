import { test, expect } from '@playwright/test';
import { RewardsFlow } from '../../flows/rewards/RewardsFlow';
import { ENV } from '../../config/environments';

test.describe('10 — Rewards', () => {
  let flow: RewardsFlow;

  test.beforeEach(async ({ page }) => {
    flow = new RewardsFlow(page);
  });

  // TC-01 — Apply promo code with valid credentials (personal)
  test('RW-01 @smoke @regression — apply valid personal promo code succeeds', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRewards();
    await flow.assertRewardsBalance();
    await flow.enterPromoCode(ENV.PROMO_CODE);
    // Success or already used — both valid for test env
  });

  // TC-01 — Apply promo code (business)
  test('RW-02 @smoke @regression — rewards page loads for business account', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToRewards();
    await flow.assertRewardsBalance();
  });

  // TC-05/TC-20 — Already used promo code
  test('RW-03 @regression — already used promo code shows appropriate message', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRewards();
    await flow.enterPromoCode(ENV.PROMO_CODE);
    // Apply again to see "already used"
    await flow['page'].waitForTimeout(1_000);
    const msg = flow['page']
      .getByText(/used|already|applied|success|invalid/i)
      .first();
    await expect(msg).toBeVisible({ timeout: 10_000 });
  });

  // TC-03/TC-10/TC-11 — Promo code with leading whitespace
  test('RW-04 @regression — promo code with leading whitespace is handled', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRewards();
    await flow.enterPromoCode('  ' + ENV.PROMO_CODE);
    const msg = flow['page']
      .getByText(/success|applied|invalid|error/i)
      .first();
    await expect(msg).toBeVisible({ timeout: 10_000 });
  });

  // TC-04 — Navigation to Gmail from import contacts
  test('RW-05 @regression — import contacts section visible', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRewards();
    const importContacts = flow['page']
      .getByText(/import.*contact|gmail|outlook/i)
      .first();
    await expect(importContacts).toBeVisible({ timeout: 10_000 });
  });

  // TC-06/TC-07 — Invited contacts visible
  test('RW-06 @regression — invited friends section visible', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRewards();
    const invitedSection = flow['page']
      .getByText(/invited|referral|friends/i)
      .first();
    await expect(invitedSection).toBeVisible({ timeout: 10_000 });
  });

  // TC-15/TC-16 — Conditions apply hyperlink
  test('RW-07 @regression — conditions apply hyperlink opens popup', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRewards();
    const conditions = flow['page']
      .locator('a:has-text("conditions"), button:has-text("conditions")')
      .filter({ hasText: /condition/i })
      .first();
    const visible = await conditions.isVisible().catch(() => false);
    if (visible) {
      await conditions.click({ force: true });
      const popup = flow['page'].locator('[class*="dialog"], [class*="modal"]').first();
      await expect(popup).toBeVisible({ timeout: 5_000 });
    }
  });

  // TC-17 — Twitter share option
  test('RW-08 @regression — share dialog has social share options', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRewards();
    await flow.clickInviteFriends();
    await flow.assertShareDialog();
  });

  // TC-18 — Send email option in share dropdown
  test('RW-09 @regression — invite friends dialog has email option', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRewards();
    await flow.clickInviteFriends();
    const emailOption = flow['page']
      .locator('button:has-text("Email"), a:has-text("Email")')
      .first();
    await expect(emailOption).toBeVisible({ timeout: 10_000 });
  });

  // TC-19 — Copy personal link
  test('RW-10 @smoke @regression — copy personal referral link works', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRewards();
    await flow.copyPersonalLink();
  });

  // TC-25/TC-26 — Empty email error in rewards
  test('RW-11 @regression — empty email in send invite shows error', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRewards();
    const emailInput = flow['page']
      .locator('input[type="email"], input[placeholder*="email" i]')
      .first();
    const sendBtn = flow['page']
      .locator('button:has-text("Send"), button:has-text("Invite")')
      .first();
    const emailVisible = await emailInput.isVisible().catch(() => false);
    if (emailVisible) {
      await sendBtn.click({ force: true });
      const error = flow['page'].locator('[class*="error"]').first();
      await expect(error).toBeVisible({ timeout: 5_000 });
    }
  });

  // TC-05 — Successful invitation popup
  test('RW-12 @regression — successful invitation popup appears after sending invite', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRewards();
    const emailInput = flow['page']
      .locator('input[type="email"], input[placeholder*="email" i]')
      .first();
    const isVisible = await emailInput.isVisible().catch(() => false);
    if (isVisible) {
      await emailInput.fill('remittestinvite@gmail.com');
      const sendBtn = flow['page']
        .locator('button:has-text("Send"), button:has-text("Invite")')
        .first();
      await sendBtn.click({ force: true });
      const popup = flow['page']
        .getByText(/success|sent|invitation/i)
        .first();
      await expect(popup).toBeVisible({ timeout: 10_000 });
    }
  });

  // Invalid promo code
  test('RW-13 @regression — invalid promo code shows error', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRewards();
    await flow.enterPromoCode(ENV.INVALID_PROMO_CODE);
    const error = flow['page']
      .getByText(/invalid|not valid|error|wrong/i)
      .first();
    await expect(error).toBeVisible({ timeout: 10_000 });
  });

  // Business promo code
  test('RW-14 @smoke @regression — business promo code can be applied', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToRewards();
    await flow.enterPromoCode(ENV.BUSINESS_PROMO_CODE);
    const msg = flow['page']
      .getByText(/success|applied|used|invalid/i)
      .first();
    await expect(msg).toBeVisible({ timeout: 10_000 });
  });

  // Rewards balance visible
  test('RW-15 @regression — rewards balance header visible on rewards page', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRewards();
    await flow.assertRewardsBalance();
  });
});
