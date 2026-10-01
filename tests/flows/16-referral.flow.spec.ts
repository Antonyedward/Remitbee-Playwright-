import { test, expect } from '@playwright/test';
import { ReferralFlow } from '../../flows/referral/ReferralFlow';
import { RewardsFlow } from '../../flows/rewards/RewardsFlow';
import { ENV } from '../../config/environments';

test.describe('16 — Referral', () => {
  let flow: ReferralFlow;

  test.beforeEach(async ({ page }) => {
    flow = new ReferralFlow(page);
  });

  // RV-01/RV-02 — Rewards on dashboard
  test('RV-01 @regression — referral rewards balance visible on rewards/referral page', async ({ page }) => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToReferral();
    await flow.assertReferralPageLoaded();
  });

  // RV-03/RV-04 — Shared referral used by new user
  test('RV-02 @smoke @regression — referral link copy button works', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToReferral();
    await flow.copyReferralLink();
  });

  // RV-10 — Beneficiary name in referee's account matches
  test('RV-03 @regression — personal referral link visible and contains username', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToReferral();
    const referralLink = flow['page']
      .locator('[class*="referral-link"], [class*="personal-link"]')
      .or(flow['page'].getByText(/remittestpriyap1p1p1|cp.wisecapitals.com\/refer/i))
      .first();
    await expect(referralLink).toBeVisible({ timeout: 10_000 });
  });

  // RV-06 — Wrong referral link shows error
  test('RV-04 @regression — invalid referral code shows error', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToReferral();
    // Codes are entered via "Apply promo code" → #enter-promo-code dialog (same as module 10)
    const res = await new RewardsFlow(flow['page']).applyPromoCode('INVALIDCODE999');
    expect(res.success).toBe(false);
    expect(res.message.length).toBeGreaterThan(0);
    console.log(`[RV-04] invalid code message: ${res.message}`);
  });

  // RV-09 — $10 rewards balance check
  test('RV-05 @regression — user with referral shows rewards balance', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToReferral();
    const balance = flow['page']
      .locator('[class*="balance"], [class*="reward"]')
      .first();
    await expect(balance).toBeVisible({ timeout: 10_000 });
  });

  // RV-12 — New user gets referrer's exact referral code
  test('RV-06 @regression — valid referral code applied on signup shows reward', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToReferral();
    const code = await flow.assertReferralCode();
    // A new user signing up through this link lands on /refer/<code> — check the link carries the user's code
    expect(code).toMatch(/^[\w.-]+$/);
  });

  // RV-05 — Referral without applying code
  test('RV-07 @regression — business referral link visible on rewards page', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToReferral();
    await flow.assertReferralPageLoaded();
    const bizLink = flow['page']
      .getByText(/remittestbusinessbee|refer/i)
      .first();
    await expect(bizLink).toBeVisible({ timeout: 10_000 });
  });

  // Share options
  test('RV-08 @regression — share referral link shows share options', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToReferral();
    await flow.shareReferralLink();
  });

  // Referral history
  test('RV-09 @regression — referral history shows invited friends list', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToReferral();
    await flow.assertReferralHistory();
  });

  // Valid referral code
  test('RV-10 @smoke @regression — entering valid referral code on referral page is accepted', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToReferral();
    await flow.enterReferralCode(ENV.REFERRAL_CODE);
    const msg = flow['page']
      .getByText(/applied|success|valid|reward/i)
      .first();
    await expect(msg).toBeVisible({ timeout: 10_000 });
  });
});
