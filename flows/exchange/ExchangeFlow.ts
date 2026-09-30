import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';
import { ENV } from '../../config/environments';

/**
 * Currency-exchange wizard helper. Selectors verified against remitbee-cp source:
 *   pages/exchange-currency/index.js            — splash for first-time users (#exchange-currency-splash-action)
 *   src/components/currencyExchangeV2/**        — wizard
 *
 * Wizard (CurrencyExchangeWizard.tsx):  exchange → payment → [sender] → deposit → overview
 *   exchange/conversion  ExchangeConversion.tsx — CurrencyExchangeBox (CurrencyConverterBox.tsx) id="converter";
 *                        send input #sendingEnd, receive input #receiveEnd (NOT #receivingEnd as in send-money);
 *                        swap button #swap-currency; currency pickers #sendingEnd-dropDownCountry /
 *                        #receiveEnd-dropDownCountry → options li#<CURRENCY_CODE>; Continue id="continue"
 *   exchange/purpose     ExchangePurpose.tsx — DropDown #exchange-currency-purpose-selection, #purpose-selection-continue
 *   payment/select-method PaymentSourceSelection.tsx — #pay-from-balance / #pay-from-bank, #continue
 *   payment/connection-type ConnectionType.tsx — #instant-connection / #manual-connection
 *   payment/select-account  EFTList.tsx — #select-bank-account, #add-new-bank-account
 *   deposit              DepositDestinationSelection.tsx — #deposit-to-balance / #deposit-to-bank, #continue
 *   overview             Overview.tsx — #overview, #transfer-summary, #payment-summary, #deposit-summary
 *
 * NOTE: #amount is the "Cost of your exchange: 0.00 CAD" / rate TEXT, not an input.
 */
export class ExchangeFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  private path(): string {
    return new URL(this.page.url()).pathname;
  }

  async navigateToExchange(): Promise<void> {
    await this.navigateSidebar('Exchange');
    await this.page.waitForURL(/exchange-currency/i, { timeout: 15_000 });
    await this.dismissAllOverlays();

    // First-time users get a splash ("Start your exchange"); others are redirected into the wizard.
    const splashBtn = this.page.locator('#exchange-currency-splash-action');
    const converter = this.page.locator('#converter');
    await splashBtn.or(converter).first().waitFor({ state: 'visible', timeout: 40_000 });
    if (await splashBtn.isVisible().catch(() => false)) {
      await splashBtn.click();
    }
    await converter.waitFor({ state: 'visible', timeout: 30_000 });
  }

  // ── Conversion step ──────────────────────────────────────────────────────────

  private async pickCurrency(side: 'sendingEnd' | 'receiveEnd', currency: string): Promise<void> {
    const picker = this.page.locator(`#${side}-dropDownCountry`);
    await picker.waitFor({ state: 'visible', timeout: 15_000 });
    if ((await picker.textContent() ?? '').includes(currency)) return; // already selected

    await expect(async () => {
      const option = this.page.locator(`li#${currency}:visible`).first();
      if (!(await option.isVisible().catch(() => false))) await picker.click();
      await option.click({ timeout: 5_000 });
      await expect(picker).toContainText(currency, { timeout: 5_000 });
    }).toPass({ timeout: 30_000, intervals: [500, 1_000, 2_000] });
  }

  async selectFromCurrency(currency: string): Promise<void> {
    await this.pickCurrency('sendingEnd', currency);
  }

  /** Changing the "from" side can auto-flip the "to" side; pickCurrency skips if it's already set. */
  async selectToCurrency(currency: string): Promise<void> {
    await this.pickCurrency('receiveEnd', currency);
  }

  async enterAmount(amount: string): Promise<void> {
    const input = this.page.locator('#converter #sendingEnd');
    await input.waitFor({ state: 'visible', timeout: 20_000 });
    await input.click({ clickCount: 3 });
    await input.fill(amount);
    await this.page.locator('#converter #loading').first()
      .waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  /**
   * Continue from the conversion substep. As in send-money, the first click is often swallowed while
   * the rate recalculates — retry until the URL leaves /exchange-currency/exchange/conversion.
   */
  async continueFromConversion(): Promise<void> {
    const onConversion = () => /\/exchange-currency\/exchange(\/conversion)?\/?$/.test(this.path());
    const continueBtn = this.page.locator('#continue:visible').first();
    await expect(this.page.locator('#converter #receiveEnd'))
      .not.toHaveValue(/^(0(\.0+)?)?$/, { timeout: 15_000 });

    await expect(async () => {
      if (!onConversion()) return;
      await expect(continueBtn).toBeEnabled({ timeout: 5_000 });
      await continueBtn.click();
      await expect.poll(onConversion, { timeout: 8_000 }).toBe(false);
    }).toPass({ timeout: 45_000, intervals: [1_000, 2_000, 3_000] });
  }

  /** ExchangePurpose.tsx — skip if a purpose is already selected (placeholder not shown). */
  async selectFirstPurpose(): Promise<void> {
    const field = this.page.locator('button#exchange-currency-purpose-selection');
    await field.waitFor({ state: 'visible', timeout: 15_000 });
    if (!(await field.getByText(/select/i).isVisible().catch(() => false))) return;

    await expect(async () => {
      const item = this.page.locator('li[id^="purpose-"]:visible').first();
      if (!(await item.isVisible().catch(() => false))) await field.click();
      await item.click({ timeout: 5_000 });
      await expect(field.getByText(/select/i)).toBeHidden({ timeout: 3_000 });
    }).toPass({ timeout: 20_000, intervals: [500, 1_000, 2_000] });
  }

  /** Conversion → purpose → payment source selection (#pay-from-balance / #pay-from-bank). */
  async goToPaymentStep(amount: string): Promise<void> {
    await this.enterAmount(amount);
    await this.continueFromConversion();

    const purpose = this.page.locator('#purpose-selection');
    const paymentTitle = this.page.locator('#payment-source-title');
    await purpose.or(paymentTitle).first().waitFor({ state: 'visible', timeout: 25_000 });
    if (await purpose.isVisible().catch(() => false)) {
      await this.selectFirstPurpose();
      await this.page.locator('#purpose-selection-continue').click();
    }
    await paymentTitle.waitFor({ state: 'visible', timeout: 25_000 });
  }

  // ── Payment / deposit steps ──────────────────────────────────────────────────

  async clickPayFromBalance(): Promise<void> {
    await this.page.locator('#pay-from-balance').click();
  }

  async clickPayFromBank(): Promise<void> {
    await this.page.locator('#pay-from-bank').click();
  }

  /**
   * From the payment-source step, reach the bank-connection options (ConnectionType.tsx:
   * #instant-connection / #manual-connection, each "Total fees: Free").
   *  - no saved bank   → app goes straight to /payment/connection-type
   *  - saved bank(s)   → /payment/select-account (EFTList) → click #add-new-bank-account
   *  - seen live (CE-12 trace): some accounts with a saved bank skip to /deposit/select-method.
   *    Then open the same route the app's own "Add new bank account" uses (Payment.tsx
   *    handleAddNewAccount → router.push('/exchange-currency/payment/connection-type')).
   */
  async openBankConnectionOptions(): Promise<void> {
    await this.clickPayFromBank();
    await this.clickContinue();

    await expect.poll(() => this.path(), { timeout: 20_000 })
      .toMatch(/\/exchange-currency\/(payment\/(select-account|connection-type)|deposit)/);

    const path = this.path();
    if (/payment\/select-account/.test(path)) {
      await this.page.locator('#add-new-bank-account').click();
    } else if (/\/deposit/.test(path)) {
      await this.page.goto(ENV.BASE_URL + '/exchange-currency/payment/connection-type', { waitUntil: 'domcontentloaded' });
    }
    await expect(this.page.locator('#instant-connection, #manual-connection').first())
      .toBeVisible({ timeout: 25_000 });
  }

  async clickDepositToBalance(): Promise<void> {
    await this.page.locator('#deposit-to-balance').click();
  }

  async clickDepositToBank(): Promise<void> {
    await this.page.locator('#deposit-to-bank').click();
  }

  /** Click the visible step Continue (every CE step uses id="continue"). */
  async clickContinue(): Promise<void> {
    const btn = this.page.locator('#continue:visible').first();
    await expect(btn).toBeEnabled({ timeout: 15_000 });
    await btn.click();
  }

  /** Backwards-compatible name used by older specs. */
  async clickExchange(): Promise<void> {
    await this.clickContinue();
  }

  async clickConfirm(): Promise<void> {
    await this.clickContinue();
  }

  // ── Assertions ───────────────────────────────────────────────────────────────

  /** Converter rendered with a live rate ("1 CAD = x USD" text is Typography #amount inside #converter). */
  async assertRate(): Promise<void> {
    await expect(this.page.locator('#converter')).toBeVisible({ timeout: 20_000 });
    await expect(this.page.locator('#converter #amount').first()).toContainText(/\d/, { timeout: 15_000 });
  }

  async assertPaymentSourceStep(): Promise<void> {
    await expect(this.page.locator('#payment-source-title')).toBeVisible({ timeout: 15_000 });
    await expect(this.page.locator('#pay-from-bank')).toBeVisible();
  }

  async assertOverview(): Promise<void> {
    await expect(this.page.locator('#overview, #transfer-summary').first()).toBeVisible({ timeout: 25_000 });
  }

  async assertExchangeSuccess(): Promise<void> {
    await expect(
      this.page.locator('#exchange-status-dialog').or(this.page.getByText(/exchanged|converted|success/i)).first()
    ).toBeVisible({ timeout: 20_000 });
  }

  async assertTransferSummary(): Promise<void> {
    await expect(this.page.locator('#transfer-summary').first()).toBeVisible({ timeout: 15_000 });
  }

  /** "Minimum exchanging amount is $10 CAD" — shown under the input only after Continue is processed. */
  async triggerMinimumAmountError(): Promise<void> {
    const continueBtn = this.page.locator('#continue:visible').first();
    const minError = this.page.getByText(/minimum exchanging amount/i).first();
    await expect(async () => {
      if (await minError.isVisible().catch(() => false)) return;
      if (await continueBtn.isEnabled().catch(() => false)) await continueBtn.click();
      await expect(minError).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 30_000, intervals: [1_000, 2_000] });
  }

  /**
   * Limit messages (ExchangeConversion.tsx): live "Maximum exchanging amount is $X CAD" under the input,
   * or an alert: "maximum daily exchange limit", "daily exchanging limit available", "additional documents".
   */
  async assertLimitError(): Promise<void> {
    await expect(
      this.page.getByText(/maximum exchanging amount|maximum daily exchang|exchanging limit|exchange limit|additional documents/i).first()
    ).toBeVisible({ timeout: 15_000 });
  }

  async assertInsufficientBalanceError(): Promise<void> {
    await expect(this.page.getByText(/insufficient balance/i).first()).toBeVisible({ timeout: 15_000 });
  }
}
