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

  /**
   * Promo code (RewardsBalance.tsx → ApplyPromoDialog.tsx):
   *   "Apply promo code" link under the balance → Dialog id="enter-promo-code" → Input #promo-code-input
   *   → "Apply" (#dialog-button-primaryAction). The dialog closes immediately; the result is either
   *   the success dialog #rewards-dialog (RewardsAnimation) or promoCodeError, which is shown as
   *   #promo-code-input-error-text the next time the dialog is opened.
   */
  async openPromoDialog(): Promise<void> {
    const dialog = this.page.locator('#enter-promo-code');
    if (await dialog.isVisible().catch(() => false)) return;
    await this.page.getByText('Apply promo code', { exact: true }).first().click();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
  }

  async enterPromoCode(code: string): Promise<void> {
    await this.openPromoDialog();
    await this.page.locator('#promo-code-input').fill(code);
  }

  /** Apply and return { success, message } — message is the error text when not successful. */
  async applyPromoCode(code: string): Promise<{ success: boolean; message: string }> {
    await this.enterPromoCode(code);
    await this.page.locator('#enter-promo-code #dialog-button-primaryAction').click();
    const successDialog = this.page.locator('#rewards-dialog');
    // Wait for the redeem call to finish (success dialog, or the loader gone)
    await successDialog.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
    if (await successDialog.isVisible().catch(() => false)) {
      const message = (await successDialog.innerText()).trim();
      await successDialog.locator('#dialog-button-primaryAction').click().catch(() => {});
      return { success: true, message };
    }
    const snack = this.page.locator('[id^="snackbar-"]').first();
    if (await snack.isVisible().catch(() => false)) {
      return { success: false, message: (await snack.innerText()).trim() };
    }
    // Error is kept in state and rendered under the input when the dialog is reopened
    await this.openPromoDialog();
    const err = this.page.locator('#promo-code-input-error-text');
    await expect(err).toBeVisible({ timeout: 15_000 });
    return { success: false, message: (await err.innerText()).trim() };
  }

  /** "Share link" (#your-personal-link-share) → Dialog #share-dialog with #copy-link and #send-email. */
  async clickInviteFriends(): Promise<void> {
    await this.page.locator('#your-personal-link-share:visible').first().click();
    await expect(this.page.locator('#share-dialog')).toBeVisible({ timeout: 15_000 });
  }

  async assertShareDialog(): Promise<void> {
    const dialog = this.page.locator('#share-dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.locator('#copy-link')).toBeVisible();
    await expect(dialog.locator('#send-email')).toBeVisible();
  }

  async copyPersonalLink(): Promise<void> {
    const copy = this.page.locator('#copy-personal-link:visible').first();
    await copy.click();
    await expect(copy).toContainText(/copied/i, { timeout: 10_000 });
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
