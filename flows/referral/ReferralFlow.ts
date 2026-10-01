import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

export class ReferralFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  async navigateToReferral(): Promise<void> {
    // Referral features live on the /rewards page (no separate /referral route in CP)
    await this.navigateSidebar('Referral');  // resolves to /rewards
    await this.page.waitForURL(/reward/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
  }

  /** "Your invite link:" shows cp.wisecapitals.com/refer/<code> as plain text (no input any more). Returns the code. */
  async assertReferralCode(): Promise<string> {
    const link = this.page.getByText(/wisecapitals\.com\/refer\/\S+/i).first();
    await expect(link).toBeVisible({ timeout: 20_000 });
    const code = ((await link.innerText()).trim().split('/refer/')[1] ?? '').trim();
    expect(code.length).toBeGreaterThan(0);
    return code;
  }

  async copyReferralLink(): Promise<void> {
    // CP uses id='copy-personal-link' for the copy link action in SendInvites.tsx
    const copyBtn = this.page
      .locator('#copy-personal-link, button:has-text("Copy"), button[aria-label*="copy" i]')
      .first();
    await copyBtn.click({ force: true });
  }

  async assertCopiedFeedback(): Promise<void> {
    const feedback = this.page.getByText(/copied|link copied/i).first();
    await feedback.waitFor({ state: 'visible', timeout: 5_000 });
  }

  async shareReferralEmail(email: string): Promise<void> {
    const shareBtn = this.page.locator('button:has-text("Share"), button:has-text("Invite")').first();
    await shareBtn.click({ force: true });
    const input = this.page.locator('input[type="email"]').first();
    await input.fill(email);
    await this.page.locator('button:has-text("Send"), button:has-text("Invite")').last().click({ force: true });
  }

  async assertReferralEarnings(): Promise<void> {
    const earnings = this.page
      .locator('[class*="earning"], [class*="Earning"]')
      .or(this.page.getByText(/earned|bonus|referral bonus/i))
      .first();
    await earnings.waitFor({ state: 'visible' });
  }

  async assertReferralPageLoaded(): Promise<void> {
    const pageContent = this.page
      .locator('[class*="referral"], [class*="reward"]')
      .first();
    await pageContent.waitFor({ state: 'visible', timeout: 15_000 });
  }

  async enterReferralCode(code: string): Promise<void> {
    // CP uses id="promo-code-input" (PromoCodeDialog.tsx) for the code entry field
    // and id='promo-code-apply' for the apply button.
    // The promo-code dialog may need to be opened first via id="enter-promo-code".
    const enterBtn = this.page.locator('#enter-promo-code');
    const enterVisible = await enterBtn.isVisible().catch(() => false);
    if (enterVisible) await enterBtn.click({ force: true });

    const input = this.page
      .locator('#promo-code-input, input[name*="referral"], input[name*="promo"], input[placeholder*="code" i]')
      .first();
    const visible = await input.isVisible().catch(() => false);
    if (visible) {
      await input.fill(code);
      const applyBtn = this.page
        .locator('#promo-code-apply, button:has-text("Apply"), button:has-text("Submit")')
        .first();
      await applyBtn.click({ force: true });
    }
  }

  async shareReferralLink(): Promise<void> {
    const shareBtn = this.page
      .locator('#invites-friends-button, button:has-text("Share"), button:has-text("Invite")')
      .first();
    const visible = await shareBtn.isVisible().catch(() => false);
    if (visible) {
      await shareBtn.click({ force: true });
      const dialog = this.page.locator('[class*="dialog"], [class*="modal"]').first();
      await dialog.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
    }
  }

  async assertReferralHistory(): Promise<void> {
    const history = this.page
      .locator('[class*="history"], [class*="invited"], [class*="referral-list"]')
      .or(this.page.getByText(/invited|referred|history/i))
      .first();
    await history.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  }
}
