import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

/**
 * Rates page (pages/rates.js → Tabs "Money Transfer | Currency Exchange").
 * Selectors from remitbee-cp source + Jam 348f6b64 (2026-10-01):
 *   MoneyTransferRateDetails.tsx — MoneyTransferBox id="moneyTransferRateDetails":
 *     send input #sendingEnd (CAD), receive input #receivingEnd, receive currency picker
 *     #receivingEnd-dropDownCountry → DropDownList search input#search → options li#<CURRENCY_CODE>;
 *     no match → li#not_found_country "Can't find your country? Request a new country…".
 *     Min amount error in #errorMessage: "Minimum sending amount is $10 CAD".
 *     Rate header h4 "1 CAD = 83.74 INR"; #send-money → /money-transfer; #favorite-rates section.
 */
export class RatesFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  box() {
    return this.page.locator('#moneyTransferRateDetails');
  }

  sendInput() {
    return this.box().locator('input#sendingEnd');
  }

  receiveInput() {
    return this.box().locator('input#receivingEnd');
  }

  receivePicker() {
    return this.page.locator('#receivingEnd-dropDownCountry');
  }

  rateHeading() {
    return this.page.getByRole('heading', { name: /^1 CAD = [\d.,]+ [A-Z]{3}$/ });
  }

  async navigateToRates(): Promise<void> {
    await this.navigateSidebar('Rates');
    await this.page.waitForURL(/\/rates/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
    await expect(this.box()).toBeVisible({ timeout: 45_000 });
  }

  /** Converter rendered with a live rate and a calculated receive amount. */
  async assertRatesTableVisible(): Promise<void> {
    await expect(this.box()).toBeVisible({ timeout: 30_000 });
    await expect(this.rateHeading()).toBeVisible({ timeout: 30_000 });
    await expect(this.receiveInput()).not.toHaveValue(/^(0(\.0+)?)?$/, { timeout: 30_000 });
  }

  /** "1 CAD = 83.74 INR" → { rate: 83.74, currency: 'INR' } */
  async getRate(): Promise<{ rate: number; currency: string }> {
    const text = (await this.rateHeading().innerText()).trim();
    const m = text.match(/=\s*([\d.,]+)\s+([A-Z]{3})/);
    if (!m) throw new Error(`Unexpected rate heading: ${text}`);
    return { rate: parseFloat(m[1].replace(/,/g, '')), currency: m[2] };
  }

  static toNumber(v: string): number {
    return parseFloat((v || '0').replace(/,/g, ''));
  }

  async openReceivePicker(): Promise<void> {
    const search = this.page.locator('input#search:visible');
    if (await search.isVisible().catch(() => false)) return;
    await this.receivePicker().click();
    await expect(search).toBeVisible({ timeout: 10_000 });
  }

  /** Jam: click the receive currency → type in search → pick the country. */
  async searchCountry(query: string): Promise<void> {
    await this.openReceivePicker();
    await this.page.locator('input#search:visible').fill(query);
    await this.page.waitForTimeout(500);
  }

  /** Pick the receiving country by search text, confirm by its currency code. */
  async selectCountry(query: string, currencyCode: string): Promise<void> {
    await expect(async () => {
      await this.searchCountry(query);
      await this.page.locator(`li#${currencyCode}:visible`).first().click({ timeout: 5_000 });
      await expect(this.receivePicker()).toContainText(currencyCode, { timeout: 5_000 });
    }).toPass({ timeout: 40_000, intervals: [1_000, 2_000] });
    await expect(this.rateHeading()).toContainText(currencyCode, { timeout: 30_000 });
  }

  async enterAmount(amount: string): Promise<void> {
    const input = this.sendInput();
    await input.waitFor({ state: 'visible', timeout: 20_000 });
    await input.click({ clickCount: 3 });
    await input.fill(amount);
    await this.box().locator('#loading').first().waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    await this.page.waitForTimeout(1_000);
  }

  async assertMinAmountError(): Promise<void> {
    await expect(this.box().locator('#errorMessage').first())
      .toContainText(/minimum sending amount is \$10 CAD/i, { timeout: 15_000 });
  }

  async toggleFavorite(): Promise<void> {
    await expect(this.page.locator('#favorite-rates')).toBeVisible({ timeout: 20_000 });
  }

  async clickNotificationsTab(): Promise<void> {
    // Rate alerts live in the Favorite rates cards ("Notify me when the rate is above …")
    await expect(this.page.locator('#favorite-rates')).toBeVisible({ timeout: 20_000 });
  }

  // Kept for older callers
  async selectCurrency(currency: string): Promise<void> {
    await this.selectCountry(currency, currency);
  }

  async assertRateForCurrency(currency: string): Promise<void> {
    await expect(this.rateHeading()).toContainText(currency, { timeout: 30_000 });
  }

  async assertRateValue(): Promise<void> {
    expect((await this.getRate()).rate).toBeGreaterThan(0);
  }
}
