import { Page, Locator, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

/**
 * /currency-converter is the public marketing converter (live DOM 2026-10-01):
 *   heading "Currency Converter" · "You send" textbox "Amount" + button "CA CAD"
 *   · rate "1 CAD = 83.7445 INR" · "They receive" textbox "Amount" + button "IN INR"
 *   · link "Send money" · "Top currency pairs" cards.
 * No ids on the widget — locate by role / text.
 */
export class CurrencyConverterFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  async navigateToCurrencyConverter(): Promise<void> {
    await this.navigateSidebar('Currency');
    await this.page.waitForURL(/currency.?converter|exchange.?currency/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
    await expect(this.sendInput()).toBeVisible({ timeout: 30_000 });
  }

  sendInput(): Locator {
    return this.page.getByRole('textbox', { name: 'Amount' }).first();
  }

  receiveInput(): Locator {
    return this.page.getByRole('textbox', { name: 'Amount' }).nth(1);
  }

  /** The two currency buttons ("CA CAD", "IN INR"). */
  currencyButtons(): Locator {
    return this.page.getByRole('button', { name: /^[A-Z]{2} [A-Z]{3}$/ });
  }

  static toNumber(v: string): number {
    return parseFloat((v || '').replace(/[^0-9.]/g, '')) || 0;
  }

  /**
   * The send box is a formatted money input ("1,000.00"): select-all + typing lands in the decimals.
   * Clear it with fill(''), type, and fall back to fill(amount) if the formatter mangled the value.
   */
  async enterAmount(amount: string): Promise<void> {
    const input = this.sendInput();
    await expect(input).toBeVisible({ timeout: 30_000 });
    await input.fill('');
    await input.pressSequentially(amount, { delay: 40 });
    const digits = amount.replace(/[^0-9.]/g, '');
    if (digits && !(await input.inputValue()).replace(/,/g, '').startsWith(digits)) {
      await input.fill(amount);
    }
    await this.page.waitForTimeout(1_200); // rate recalculation (debounced)
  }

  async receiveAmount(): Promise<number> {
    return CurrencyConverterFlow.toNumber(await this.receiveInput().inputValue());
  }

  async assertConvertedAmount(): Promise<void> {
    await expect.poll(() => this.receiveAmount(), { timeout: 15_000 }).toBeGreaterThan(0);
  }

  /** "1 CAD" + "<rate> <CCY>" line between the two inputs. */
  async assertExchangeRate(): Promise<void> {
    await expect(this.page.getByText(/^\s*1 [A-Z]{3}\s*$/).first()).toBeVisible({ timeout: 20_000 });
    await expect(this.page.getByText(/\d[\d,]*\.\d+ [A-Z]{3}/).first()).toBeVisible({ timeout: 20_000 });
  }

  /** Change the receiving currency via its dropdown button. */
  async selectToCurrency(code: string): Promise<void> {
    const btn = this.currencyButtons().nth(1);
    await btn.click();
    const search = this.page.locator('input[placeholder*="search" i]:visible, input#search:visible').first();
    if (await search.isVisible({ timeout: 3_000 }).catch(() => false)) await search.fill(code);
    const option = this.page.locator('li:visible, [role="option"]:visible')
      .filter({ hasText: new RegExp(`\\b${code}\\b`) }).first();
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
    await expect(this.currencyButtons().nth(1)).toContainText(code, { timeout: 10_000 });
  }

  /** Kept for older callers — the sending side is fixed to CAD, so this changes the receiving side. */
  async selectFromCurrency(code: string): Promise<void> {
    await this.selectToCurrency(code);
  }

  async clickSendThisAmount(): Promise<void> {
    await this.page.getByRole('link', { name: /^send money$/i }).first().click();
  }

  async swapCurrencies(): Promise<void> {
    await this.page.locator('button[aria-label*="swap" i], button:has-text("Swap"), button[class*="swap"]').first().click();
  }
}
