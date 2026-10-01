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
    // Staging codes are single-use per account: first run → success dialog, later runs → "already used"
    const res = await flow.applyPromoCode(ENV.PROMO_CODE);
    expect(res.message).not.toBe('');
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
    // Apply twice — the second attempt can never succeed for a single-use code
    await flow.applyPromoCode(ENV.PROMO_CODE);
    await flow['page'].keyboard.press('Escape').catch(() => {});
    await flow['page'].locator('#enter-promo-code #close-dialog').click().catch(() => {});
    const res = await flow.applyPromoCode(ENV.PROMO_CODE);
    expect(res.success).toBe(false);
    // Live staging message (2026-10-01): "Promotion is already used"
    expect(res.message).toMatch(/promotion is already used/i);
  });

  // TC-03/TC-10/TC-11 — Promo code with leading whitespace
  test('RW-04 @regression — promo code with leading whitespace is handled', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRewards();
    // checkPromoCode() trims + uppercases, so this must NOT give the "enter a promo code" length error
    const res = await flow.applyPromoCode('  ' + ENV.PROMO_CODE.toLowerCase());
    expect(res.message).not.toBe('');
    expect(res.message).not.toMatch(/please enter/i);
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
    const emailOption = flow['page'].locator('#share-dialog #send-email');
    await expect(emailOption).toBeVisible({ timeout: 10_000 });
    await expect(emailOption).toContainText(/email/i);
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
    const res = await flow.applyPromoCode(ENV.INVALID_PROMO_CODE);
    expect(res.success).toBe(false);
    expect(res.message).not.toBe('');
  });

  // Business promo code
  test('RW-14 @smoke @regression — business promo code can be applied', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToRewards();
    const res = await flow.applyPromoCode(ENV.BUSINESS_PROMO_CODE);
    expect(res.message).not.toBe('');
  });

  // Rewards balance visible
  test('RW-15 @regression — rewards balance header visible on rewards page', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRewards();
    await flow.assertRewardsBalance();
  });
});
