import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

export class WalletFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  async navigateToWallet(): Promise<void> {
    await this.navigateSidebar('Wallet');  // resolves to /balance
    await this.page.waitForURL(/balance/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
  }

  async assertWalletBalance(): Promise<void> {
    // CP uses id="balance-details" (BalanceFullCard) or id="wallet-balance" for the balance widget
    const balance = this.page
      .locator('#balance-details, #wallet-balance, [class*="balance"], [class*="Balance"]')
      .first();
    await balance.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(balance).toBeVisible();
  }

  async clickDeposit(): Promise<void> {
    await this.page
      .locator('button:has-text("Deposit"), button:has-text("Add money"), a:has-text("Deposit")')
      .first()
      .click({ force: true });
  }

  async clickWithdraw(): Promise<void> {
    await this.page
      .locator('button:has-text("Withdraw"), button:has-text("Transfer out"), a:has-text("Withdraw")')
      .first()
      .click({ force: true });
  }

  async enterDepositAmount(amount: string): Promise<void> {
    const input = this.page.locator('input[name*="amount"], input[placeholder*="amount" i]').first();
    await input.waitFor({ state: 'visible' });
    await input.fill(amount);
  }

  async selectDepositPaymentMethod(method: string): Promise<void> {
    const option = this.page
      .locator('[class*="payment"], [class*="method"]')
      .filter({ hasText: new RegExp(method, 'i') })
      .first();
    await option.click({ force: true });
  }

  async clickContinue(): Promise<void> {
    // CP wallet/exchange wizard uses id="continue" for step progression
    const btn = this.page.locator('#continue').first();
    const found = await btn.isVisible().catch(() => false);
    if (found) {
      await btn.click({ force: true });
    } else {
      await this.page
        .locator('button:has-text("Continue"), button:has-text("Next")')
        .first()
        .click({ force: true });
    }
  }

  async clickConfirm(): Promise<void> {
    // CP wallet uses id="continue" for confirmation steps too
    await this.page
      .locator('#continue, button:has-text("Confirm"), button:has-text("Submit")')
      .first()
      .click({ force: true });
  }

  async clickDepositToBalance(): Promise<void> {
    // CP balance wizard uses id="deposit-confirm" and id="payment-type-continue"
    // "Deposit to Balance" is in currencyExchangeV2; in /balance it uses id="deposit-method" or id="select-payment-method"
    const btn = this.page.locator('#deposit-confirm, #payment-type-continue, #deposit-method').first();
    const found = await btn.isVisible().catch(() => false);
    if (found) await btn.click({ force: true });
    else await this.page.locator('button:has-text("Deposit to balance"), button:has-text("Deposit")').first().click({ force: true });
  }

  async clickDepositToBank(): Promise<void> {
    // CP balance wizard uses id="deposit-bank" for the bank destination
    const btn = this.page.locator('#deposit-bank, #select-eft-continue').first();
    const found = await btn.isVisible().catch(() => false);
    if (found) await btn.click({ force: true });
    else await this.page.locator('button:has-text("Deposit to bank"), button:has-text("Bank deposit")').first().click({ force: true });
  }

  async assertDepositSuccess(): Promise<void> {
    const success = this.page
      .locator('#exchange-status-dialog, [class*="success"]')
      .or(this.page.getByText(/deposit.*success|added.*wallet|success/i))
      .first();
    await success.waitFor({ state: 'visible', timeout: 20_000 });
  }

  async assertWithdrawSuccess(): Promise<void> {
    const success = this.page
      .locator('#exchange-status-dialog, [class*="success"]')
      .or(this.page.getByText(/withdraw.*success|transferred|success/i))
      .first();
    await success.waitFor({ state: 'visible', timeout: 20_000 });
  }

  async assertWalletCurrencies(): Promise<void> {
    const currencies = this.page.locator('[class*="currency"], [class*="Currency"]').first();
    await currencies.waitFor({ state: 'visible' });
    await expect(currencies).toBeVisible();
  }
}
