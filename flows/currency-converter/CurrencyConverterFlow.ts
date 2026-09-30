import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

export class CurrencyConverterFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  async navigateToCurrencyConverter(): Promise<void> {
    // NAV_PATHS['currency'] → /currency-converter (public marketing converter)
    // NAV_PATHS['exchange'] → /exchange-currency (full CE wizard)
    // waitForURL covers both routes.
    await this.navigateSidebar('Currency');
    await this.page.waitForURL(/currency.?converter|exchange.?currency/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
  }

  async enterAmount(amount: string): Promise<void> {
    // In the CE wizard, id='converter' wraps the conversion widget (ExchangeConversion.tsx).
    // The actual amount input lives inside it; fall back to name/placeholder selectors.
    const input = this.page
      .locator('input[name*="amount"], input[placeholder*="amount" i], #converter input')
      .first();
    await input.waitFor({ state: 'visible' });
    await input.clear();
    await input.fill(amount);
  }

  async selectFromCurrency(currency: string): Promise<void> {
    const selector = this.page
      .locator('[class*="from"], [data-testid*="from"]')
      .locator('[class*="Select"], [class*="Dropdown"], select')
      .first();
    await selector.click({ force: true });
    await this.page.getByText(currency, { exact: false }).first().click();
  }

  async selectToCurrency(currency: string): Promise<void> {
    const selector = this.page
      .locator('[class*="to"], [data-testid*="to"]')
      .locator('[class*="Select"], [class*="Dropdown"], select')
      .first();
    await selector.click({ force: true });
    await this.page.getByText(currency, { exact: false }).first().click();
  }

  async assertConvertedAmount(): Promise<void> {
    // CP uses id='converter' for the conversion widget; id='amount' for the calculated label.
    const result = this.page
      .locator('#converter, #amount, [class*="result"], [class*="Result"], [class*="converted"]')
      .first();
    await result.waitFor({ state: 'visible' });
    const text = await result.textContent();
    expect(parseFloat(text?.replace(/[^0-9.]/g, '') || '0')).toBeGreaterThan(0);
  }

  async assertExchangeRate(): Promise<void> {
    // CP uses id='converter' for the main rate widget in the CE wizard
    const rate = this.page
      .locator('#converter, [class*="rate"], [class*="Rate"]')
      .first();
    await rate.waitFor({ state: 'visible' });
    await expect(rate).toBeVisible();
  }

  async swapCurrencies(): Promise<void> {
    const swapBtn = this.page
      .locator('button[aria-label*="swap" i], button:has-text("Swap"), button[class*="swap"]')
      .first();
    await swapBtn.click({ force: true });
  }

  async clickSendThisAmount(): Promise<void> {
    await this.page
      .locator('button:has-text("Send"), a:has-text("Send this amount"), button:has-text("Transfer")')
      .first()
      .click({ force: true });
  }
}
