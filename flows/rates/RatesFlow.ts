import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

export class RatesFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  async navigateToRates(): Promise<void> {
    await this.navigateSidebar('Rates');
    await this.page.waitForURL(/rate/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
  }

  async assertRatesTableVisible(): Promise<void> {
    // CP rates page uses id="converter" for the main rates converter widget
    const table = this.page
      .locator('#converter, table, [class*="rates-table"]')
      .first();
    await table.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(table).toBeVisible();
  }

  async selectCurrency(currency: string): Promise<void> {
    // CP uses id="rates-receiving-country-select" for the destination currency selector
    const selector = this.page
      .locator('#rates-receiving-country-select, [class*="currency-select"]')
      .first();
    await selector.click({ force: true });
    await this.page.getByText(currency, { exact: false }).first().click();
  }

  async assertRateForCurrency(currency: string): Promise<void> {
    const rateRow = this.page.locator('tr, [class*="rate-row"]').filter({ hasText: currency }).first();
    await rateRow.waitFor({ state: 'visible' });
    await expect(rateRow).toBeVisible();
  }

  async assertRateValue(): Promise<void> {
    const rateValue = this.page.locator('[class*="rate-value"], [class*="RateValue"]').first();
    await rateValue.waitFor({ state: 'visible' });
    const text = await rateValue.textContent();
    expect(parseFloat(text || '0')).toBeGreaterThan(0);
  }

  async selectCountry(query: string): Promise<void> {
    const dropdown = this.page
      .locator('[class*="country-select"], [class*="CountrySelect"], [class*="currency-dropdown"]')
      .first();
    const visible = await dropdown.isVisible().catch(() => false);
    if (visible) {
      await dropdown.click({ force: true });
    }
    const searchInput = this.page
      .locator('input[placeholder*="search" i], input[placeholder*="country" i]')
      .first();
    const searchVisible = await searchInput.isVisible().catch(() => false);
    if (searchVisible) {
      await searchInput.fill(query);
      await this.page.waitForTimeout(500);
      const option = this.page.getByText(new RegExp(query, 'i')).first();
      await option.click({ force: true }).catch(() => {});
    }
  }

  async enterAmount(amount: string): Promise<void> {
    const input = this.page
      .locator('input[name*="amount"], input[placeholder*="amount" i], input[type="number"]')
      .first();
    const visible = await input.isVisible().catch(() => false);
    if (visible) {
      await input.fill(amount);
      await input.dispatchEvent('input');
    }
  }

  async searchCountry(query: string): Promise<void> {
    const searchInput = this.page
      .locator('input[placeholder*="search" i], input[placeholder*="country" i]')
      .first();
    const visible = await searchInput.isVisible().catch(() => false);
    if (visible) {
      await searchInput.fill(query);
      await this.page.waitForTimeout(500);
    } else {
      // Open dropdown first then search
      const dropdown = this.page
        .locator('[class*="country-select"], [class*="CountrySelect"]')
        .first();
      await dropdown.click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(300);
      const inputAfterOpen = this.page
        .locator('input[placeholder*="search" i], input[placeholder*="country" i]')
        .first();
      await inputAfterOpen.fill(query).catch(() => {});
      await this.page.waitForTimeout(500);
    }
  }

  async toggleFavorite(): Promise<void> {
    const favStar = this.page
      .locator('[class*="favorite"], [class*="star"], button[aria-label*="favorite" i]')
      .first();
    const visible = await favStar.isVisible().catch(() => false);
    if (visible) {
      await favStar.click({ force: true });
    }
  }

  async clickNotificationsTab(): Promise<void> {
    const tab = this.page
      .locator('button:has-text("Notifications"), [role="tab"]:has-text("Notifications")')
      .first();
    const visible = await tab.isVisible().catch(() => false);
    if (visible) {
      await tab.click({ force: true });
      await this.page.waitForTimeout(500);
    }
  }
}
