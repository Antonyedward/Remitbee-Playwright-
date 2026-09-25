import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

export class HelpFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  async navigateToHelp(): Promise<void> {
    await this.navigateSidebar('Help');
    await this.page.waitForURL(/help|support/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
  }

  async assertHelpCenterVisible(): Promise<void> {
    const helpCenter = this.page
      .locator('[class*="help"], [class*="Help"]')
      .or(this.page.getByText(/help center|frequently asked|FAQ/i))
      .first();
    await helpCenter.waitFor({ state: 'visible' });
    await expect(helpCenter).toBeVisible();
  }

  async searchHelp(query: string): Promise<void> {
    const input = this.page.locator('input[type="search"], input[placeholder*="search" i]').first();
    await input.waitFor({ state: 'visible' });
    await input.fill(query);
    await this.page.keyboard.press('Enter');
  }

  async assertSearchResults(): Promise<void> {
    const results = this.page
      .locator('[class*="result"], [class*="article"], [class*="Article"]')
      .first();
    await results.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(results).toBeVisible();
  }

  async clickContactSupport(): Promise<void> {
    await this.page
      .locator('button:has-text("Contact"), button:has-text("Chat"), a:has-text("Contact us")')
      .first()
      .click({ force: true });
  }

  async clickFAQItem(index: number = 0): Promise<void> {
    const items = this.page.locator('[class*="faq"], [class*="FAQ"], details, [class*="accordion"]');
    await items.nth(index).click();
  }

  async assertFAQExpanded(): Promise<void> {
    const expanded = this.page
      .locator('[class*="faq--open"], [class*="expanded"], details[open]')
      .first();
    await expanded.waitFor({ state: 'visible', timeout: 5_000 });
    await expect(expanded).toBeVisible();
  }
}
