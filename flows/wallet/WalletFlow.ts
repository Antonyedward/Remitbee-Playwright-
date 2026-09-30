import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';
import { ENV } from '../../config/environments';

/**
 * Wallet / balance helper. Selectors verified against remitbee-cp source:
 *   pages/balance/index.js — REDIRECTS TO /dashboard when there is no ?currencyId and no selected
 *     currency, so always open /balance?currencyId=40 (CAD_CURRENCY_ID in src/shared/currency.js).
 *     Actions: #balance-deposit, #balance-withdraw, #balance-exchange. Card: #balance-details.
 *   Deposit  (BalanceDepositWizard.tsx):   amount → [sender] → deposit-method → bank-details → overview
 *   Withdraw (BalanceWithdrawalWizard.tsx): withdrawal-details → deposit-method → overview
 *   Amount step (BalanceDeposit/Amount.tsx): input #amount (CurrencyInputField), Continue id="continue",
 *     errors in #errorMessage: "Minimum depositing amount is $10 CAD", "Maximum depositing amount is
 *     $500,000 CAD", "The minimum withdrawal amount is $10 CAD".
 *   Deposit method (deposit/SelectPayType.tsx): #select-payment-method, options labelled "e-Transfer",
 *     "Bill Payment", "Direct withdrawal (EFT)"; #payment-type-continue.
 *     EFT → /bank-details/eft-bank-list (saved banks: #eft-bank-select, #select-eft-continue, #add-new-eft)
 *         or /bank-details/eft-new-bank-selection; e-Transfer/Bill → /bank-details/instructions
 *         (#wallet-deposit-instructions, Continue button id="<TYPE>-continue").
 *   Withdraw method (withdrawal/SelectWithdrawMethod.tsx): radios #EFT-<i> / #INTERAC_E_TRANSFER-<i>;
 *     then instructions/eft-bank-list → verification (VerificationCodeScreen: #code-1..6, #verify_code).
 *   Overview (deposit + withdrawal): #overview, confirm #deposit-confirm.
 *   Success dialogs: deposit #<TYPE>-dialog-box / #EFT-deposit-dialog-box; withdraw #EFT-dialog-box or
 *     e-Transfer dialog (#e-transfer-withdraw-understood).
 */
export class WalletFlow extends FlowBase {
  static readonly CAD_CURRENCY_ID = 40;

  constructor(page: Page) {
    super(page);
  }

  private path(): string {
    return new URL(this.page.url()).pathname;
  }

  async navigateToWallet(currencyId = WalletFlow.CAD_CURRENCY_ID): Promise<void> {
    await this.page.goto(`${ENV.BASE_URL}/balance?currencyId=${currencyId}`, { waitUntil: 'domcontentloaded' });
    await this.page.waitForURL(/\/balance/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
    await this.page.locator('#balance-details').waitFor({ state: 'visible', timeout: 30_000 });
  }

  async assertWalletBalance(): Promise<void> {
    const card = this.page.locator('#balance-details');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toContainText(/\$?\d[\d,]*\.\d{2}/, { timeout: 15_000 }); // a money amount
  }

  async assertWalletCurrencies(): Promise<void> {
    await expect(this.page.locator('#balance-details')).toContainText(/CAD/, { timeout: 15_000 });
  }

  async assertWalletActions(): Promise<void> {
    for (const id of ['#balance-deposit', '#balance-withdraw', '#balance-exchange']) {
      await expect(this.page.locator(id)).toBeVisible({ timeout: 15_000 });
    }
  }

  async clickDeposit(): Promise<void> {
    await this.page.locator('#balance-deposit').click();
    await this.page.waitForURL(/\/balance-deposit/, { timeout: 20_000 });
    await this.page.locator('#amount').waitFor({ state: 'visible', timeout: 20_000 });
  }

  async clickWithdraw(): Promise<void> {
    const btn = this.page.locator('#balance-withdraw');
    await expect(btn).toBeEnabled({ timeout: 15_000 }); // disabled when there's nothing to withdraw
    await btn.click();
    await this.page.waitForURL(/\/balance-withdrawal/, { timeout: 20_000 });
    await this.page.locator('#amount').waitFor({ state: 'visible', timeout: 20_000 });
  }

  /** Amount input on both deposit and withdrawal (Amount.tsx → CurrencyInputField id="amount"). */
  async enterDepositAmount(amount: string): Promise<void> {
    const input = this.page.locator('input#amount');
    await input.waitFor({ state: 'visible', timeout: 15_000 });
    await input.click({ clickCount: 3 });
    await input.fill(amount);
    await this.page.waitForTimeout(300);
  }

  async enterAmount(amount: string): Promise<void> {
    await this.enterDepositAmount(amount);
  }

  /** Amount step Continue. Validation is client-side; on success the URL leaves the amount step. */
  async continueFromAmount(): Promise<void> {
    const onAmount = () => /\/balance-(deposit|withdrawal)\/?(amount|withdrawal-details)?\/?$/.test(this.path());
    await expect(async () => {
      if (!onAmount()) return;
      await this.page.locator('#continue:visible').first().click();
      await expect.poll(onAmount, { timeout: 6_000 }).toBe(false);
    }).toPass({ timeout: 30_000, intervals: [1_000, 2_000] });
  }

  /** Amount-step validation message (#errorMessage under the input). */
  async assertAmountError(pattern: RegExp): Promise<void> {
    const err = this.page.getByText(pattern).first();
    await expect(async () => {
      if (await err.isVisible().catch(() => false)) return;
      await this.page.locator('#continue:visible').first().click();
      await expect(err).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 25_000, intervals: [1_000, 2_000] });
  }

  /** Generic step Continue (kept for older specs). */
  async clickContinue(): Promise<void> {
    await this.page.locator('#continue:visible, #payment-type-continue:visible, #select-eft-continue:visible').first().click();
  }

  async clickConfirm(): Promise<void> {
    await this.page.locator('#deposit-confirm').click();
  }

  // ── Deposit ──────────────────────────────────────────────────────────────────

  async assertDepositMethodStep(): Promise<void> {
    await expect(this.page.locator('#select-payment-method')).toBeVisible({ timeout: 25_000 });
  }

  /** Deposit method by visible label: 'e-Transfer' | 'Bill Payment' | 'Direct withdrawal (EFT)'. */
  async selectDepositPaymentMethod(label: string | RegExp): Promise<void> {
    await this.assertDepositMethodStep();
    const re = typeof label === 'string' ? new RegExp(`^${label.replace(/[()]/g, '\\$&')}$`, 'i') : label;
    await this.page.getByText(re).first().click();
    await expect(this.page.locator('#payment-type-continue')).toBeEnabled({ timeout: 10_000 });
    await this.page.locator('#payment-type-continue').click();
  }

  /** After choosing EFT: saved banks → eft-bank-list, none → eft-new-bank-selection. */
  async waitForEftBankStep(): Promise<'eft-bank-list' | 'eft-new-bank-selection'> {
    await expect.poll(() => this.path(), { timeout: 20_000 })
      .toMatch(/bank-details\/(eft-bank-list|eft-new-bank-selection)/);
    return /eft-bank-list/.test(this.path()) ? 'eft-bank-list' : 'eft-new-bank-selection';
  }

  /** Backwards-compatible names from the old spec. */
  async clickDepositToBank(): Promise<void> {
    await this.selectDepositPaymentMethod('Direct withdrawal (EFT)');
  }

  async clickDepositToBalance(): Promise<void> {
    await this.selectDepositPaymentMethod('e-Transfer');
  }

  /**
   * Full e-Transfer deposit request: amount → e-Transfer → instructions → overview → confirm.
   * NOTE: this creates a pending deposit request on staging (no money moves until the e-Transfer is sent).
   */
  async completeETransferDeposit(amount: string): Promise<void> {
    await this.enterDepositAmount(amount);
    await this.continueFromAmount();
    await this.selectDepositPaymentMethod('e-Transfer');
    // e-Transfer deposits now render ETransferInstructionsV2 ("Check your e-Transfer email" +
    // verified emails) with Continue id="check-email-continue". Other methods (and the legacy
    // screen) use the PaymentInstructions button id="<TYPE>-continue".
    const next = this.page
      .locator('#check-email-continue:visible, button[id$="-continue"]:not(#payment-type-continue):visible')
      .first();
    await next.waitFor({ state: 'visible', timeout: 25_000 });
    await next.click();
    await this.page.locator('#overview').waitFor({ state: 'visible', timeout: 20_000 });
    await this.page.locator('#deposit-confirm').click();
  }

  /**
   * After #deposit-confirm:
   *  - e-Transfer → ETransferFinishDialog (#etransfer-finish-dialog) "Send your e-Transfer" →
   *    click #etransfer-finish-sent ("I've sent the e-Transfer") → success splash
   *    "We're watching for your e-Transfer" with #etransfer-finish-got-it.
   *  - other methods → DepositStatusDialog (#<TYPE>-dialog-box / #EFT-deposit-dialog-box).
   */
  async assertDepositSuccess(): Promise<void> {
    const sentBtn = this.page.locator('#etransfer-finish-sent');
    const otherDialog = this.page.locator('[id$="-dialog-box"]').first();
    await sentBtn.or(otherDialog).first().waitFor({ state: 'visible', timeout: 25_000 });

    if (await sentBtn.isVisible().catch(() => false)) {
      await sentBtn.click();
      await expect(this.page.getByText(/we're watching for your e-transfer/i)).toBeVisible({ timeout: 15_000 });
      await expect(this.page.locator('#etransfer-finish-got-it')).toBeVisible();
    } else {
      await expect(otherDialog).toBeVisible();
    }
  }

  // ── Withdrawal ───────────────────────────────────────────────────────────────

  async assertWithdrawMethodStep(): Promise<void> {
    await expect(this.page.locator('#select-payment-method')).toBeVisible({ timeout: 25_000 });
  }

  /** Enter the OTP on the withdrawal verification step (same component as login OTP). */
  private async enterWithdrawalCode(): Promise<void> {
    await this.page.locator('#code-1').waitFor({ state: 'visible', timeout: 20_000 });
    const code = /^\d{6}$/.test(ENV.ENTER_OTP || '') ? ENV.ENTER_OTP : '121212';
    for (let i = 0; i < 6; i++) await this.page.locator(`#code-${i + 1}`).fill(code[i]);
    const verify = this.page.locator('#verify_code, #verify-code').first();
    if (await verify.isEnabled().catch(() => false)) await verify.click();
  }

  /**
   * Full withdrawal: amount → method (EFT with a saved bank if available, else e-Transfer) →
   * [bank list | instructions] → verification code → overview → confirm.
   * NOTE: this submits a real withdrawal request on staging.
   */
  async completeWithdrawal(amount: string): Promise<void> {
    await this.enterDepositAmount(amount);
    await this.continueFromAmount();
    await this.assertWithdrawMethodStep();

    const eft = this.page.locator('[id^="EFT-"]').first();
    const eTransfer = this.page.locator('[id^="INTERAC_E_TRANSFER-"]').first();
    const useEft = await eft.isVisible().catch(() => false);
    await (useEft ? eft : eTransfer).click();
    await this.page.locator('#payment-type-continue').click();

    await expect.poll(() => this.path(), { timeout: 20_000 })
      .toMatch(/deposit-method\/(eft-bank-list|eft-new-bank-selection|instructions|verification)/);
    if (/eft-new-bank-selection/.test(this.path())) {
      throw new Error('Withdrawal via EFT needs a saved bank on this account (landed on eft-new-bank-selection)');
    }
    if (/eft-bank-list/.test(this.path())) {
      await expect(this.page.locator('#select-eft-continue')).toBeEnabled({ timeout: 15_000 });
      await this.page.locator('#select-eft-continue').click();
    } else if (/instructions/.test(this.path())) {
      await this.page.locator('button[id$="-continue"]:not(#payment-type-continue):visible').first().click();
    }

    await expect.poll(() => this.path(), { timeout: 20_000 }).toMatch(/verification|overview/);
    if (/verification/.test(this.path())) await this.enterWithdrawalCode();

    await this.page.locator('#overview').waitFor({ state: 'visible', timeout: 25_000 });
    await this.page.locator('#deposit-confirm').click();
  }

  async assertWithdrawSuccess(): Promise<void> {
    await expect(
      this.page.locator('#EFT-dialog-box, #e-transfer-withdraw-understood').first()
        .or(this.page.getByText(/withdraw.*(success|submitted|requested)/i).first())
        .first()
    ).toBeVisible({ timeout: 25_000 });
  }
}
