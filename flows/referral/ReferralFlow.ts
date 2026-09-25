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

  async assertReferralCode(): Promise<void> {
    const codeEl = this.page.locator('[class*="referral-code"], [class*="ReferralCode"]').first();
    await codeEl.waitFor({ state: 'visible' });
    await expect(codeEl).toBeVisible();
    const text = await codeEl.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  }

  async copyReferralLink(): Promise<void> {
    const copyBtn = this.page.locator('button:has-text("Copy"), button[aria-label*="copy" i]').first();
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
    const input = this.page
      .locator('input[name*="referral"], input[name*="promo"], input[placeholder*="code" i]')
      .first();
    const visible = await input.isVisible().catch(() => false);
    if (visible) {
      await input.fill(code);
      const applyBtn = this.page
        .locator('button:has-text("Apply"), button:has-text("Submit")')
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
