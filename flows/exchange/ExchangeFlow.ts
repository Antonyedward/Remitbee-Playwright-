import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

export class ExchangeFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  async navigateToExchange(): Promise<void> {
    await this.navigateSidebar('Exchange');
    await this.page.waitForURL(/exchange/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
  }

  async selectFromCurrency(currency: string): Promise<void> {
    const fromSelector = this.page
      .locator('[class*="from"], [data-testid*="from"]')
      .locator('select, [class*="Select"], [class*="Dropdown"]')
      .first();
    await fromSelector.click({ force: true });
    await this.page.getByText(currency, { exact: false }).first().click();
  }

  async selectToCurrency(currency: string): Promise<void> {
    const toSelector = this.page
      .locator('[class*="to"], [data-testid*="to"]')
      .locator('select, [class*="Select"], [class*="Dropdown"]')
      .first();
    await toSelector.click({ force: true });
    await this.page.getByText(currency, { exact: false }).first().click();
  }

  async enterAmount(amount: string): Promise<void> {
    // The converter widget is id="converter"; inputs inside it handle send/receive amounts
    await this.page.locator('#converter').waitFor({ state: 'visible', timeout: 15_000 });
    const input = this.page
      .locator('#converter input, input[name*="amount"], input[placeholder*="amount" i]')
      .first();
    await input.waitFor({ state: 'visible', timeout: 10_000 });
    await input.click({ clickCount: 3 });
    await input.fill(amount);
  }

  async clickPayFromBalance(): Promise<void> {
    // CP uses id="pay-from-balance" for the Pay from Balance option
    await this.page.locator('#pay-from-balance').first().click({ force: true });
  }

  async clickPayFromBank(): Promise<void> {
    // CP uses id="pay-from-bank" for the Pay from Bank option
    await this.page.locator('#pay-from-bank').first().click({ force: true });
  }

  async clickDepositToBalance(): Promise<void> {
    await this.page.locator('#deposit-to-balance').first().click({ force: true });
  }

  async clickDepositToBank(): Promise<void> {
    await this.page.locator('#deposit-to-bank').first().click({ force: true });
  }

  async clickExchange(): Promise<void> {
    // CP uses id="continue" for the primary action button in exchange wizard
    const btn = this.page.locator('#continue').first();
    const found = await btn.isVisible().catch(() => false);
    if (found) {
      await btn.click({ force: true });
    } else {
      await this.page
        .locator('button:has-text("Exchange"), button:has-text("Convert")')
        .first()
        .click({ force: true });
    }
  }

  async clickConfirm(): Promise<void> {
    await this.page
      .locator('#continue, button:has-text("Confirm"), button:has-text("Proceed")')
      .first()
      .click({ force: true });
  }

  async assertRate(): Promise<void> {
    // CP exchange uses id="converter" for the rate converter widget
    const rateEl = this.page
      .locator('#converter, [class*="rate"], [class*="Rate"]')
      .first();
    await rateEl.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(rateEl).toBeVisible();
  }

  async assertExchangeSuccess(): Promise<void> {
    // CP shows id="exchange-status-dialog" on completion
    const success = this.page
      .locator('#exchange-status-dialog, [class*="success"]')
      .or(this.page.getByText(/exchanged|converted|success/i))
      .first();
    await success.waitFor({ state: 'visible', timeout: 20_000 });
    await expect(success).toBeVisible();
  }

  async assertTransferSummary(): Promise<void> {
    await expect(this.page.locator('#transfer-summary').first()).toBeVisible({ timeout: 15_000 });
  }

  async assertInsufficientBalanceError(): Promise<void> {
    const error = this.page
      .locator('#account-limit-warning, [class*="error"]')
      .filter({ hasText: /insufficient|balance|not enough|limit/i })
      .first();
    await error.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(error).toBeVisible();
  }
}
