import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

export class RewardsFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  async navigateToRewards(): Promise<void> {
    await this.navigateSidebar('Rewards');
    await this.page.waitForURL(/reward/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
  }

  async assertRewardsBalance(): Promise<void> {
    // CP uses id="reward-balance-header" for the rewards balance display
    const balance = this.page.locator('#reward-balance-header').first();
    await balance.waitFor({ state: 'visible' });
    await expect(balance).toBeVisible();
  }

  async assertRewardsTiers(): Promise<void> {
    const tiers = this.page.locator('[class*="tier"], [class*="Tier"]').first();
    await tiers.waitFor({ state: 'visible' });
    await expect(tiers).toBeVisible();
  }

  async enterPromoCode(code: string): Promise<void> {
    // CP uses id="enter-promo-code" to toggle the promo code input
    const toggleBtn = this.page.locator('#enter-promo-code').first();
    const isVisible = await toggleBtn.isVisible().catch(() => false);
    if (isVisible) await toggleBtn.click({ force: true });
    // Then fill id="promo-code-input"
    const input = this.page.locator('#promo-code-input').first();
    await input.waitFor({ state: 'visible' });
    await input.fill(code);
  }

  async clickInviteFriends(): Promise<void> {
    // CP uses id="invites-friends-button" for the referral/share button
    await this.page.locator('#invites-friends-button').first().click({ force: true });
  }

  async assertShareDialog(): Promise<void> {
    // CP shows id="share-dialog" with id="your-personal-link-input" and id="copy-personal-link"
    await expect(this.page.locator('#share-dialog').first()).toBeVisible({ timeout: 10_000 });
  }

  async copyPersonalLink(): Promise<void> {
    await this.page.locator('#copy-personal-link').first().click({ force: true });
  }

  async redeemRewards(amount: string): Promise<void> {
    const redeemBtn = this.page.locator('button:has-text("Redeem")').first();
    await redeemBtn.click({ force: true });
    const input = this.page.locator('input[name*="amount"], input[placeholder*="amount" i]').first();
    await input.waitFor({ state: 'visible' });
    await input.fill(amount);
    await this.page.locator('button:has-text("Confirm"), button:has-text("Redeem")').last().click({ force: true });
  }

  async assertRedemptionSuccess(): Promise<void> {
    // CP shows id="rewards-dialog" on success
    const success = this.page
      .locator('#rewards-dialog, [class*="success"]')
      .or(this.page.getByText(/redeemed|success/i))
      .first();
    await success.waitFor({ state: 'visible', timeout: 15_000 });
  }

  async assertRewardsHistory(): Promise<void> {
    const history = this.page
      .locator('[class*="history"], [class*="History"]')
      .or(this.page.getByText(/history|earned/i))
      .first();
    await history.waitFor({ state: 'visible' });
  }
}
