import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';
import { ENV } from '../../config/environments';

export class SendMoneyFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  async navigateToSendMoney(): Promise<void> {
    await this.navigateSidebar('Send');
    await this.page.waitForURL(/money-transfer/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
  }

  async selectRecipientCountry(country: string): Promise<void> {
    // CP uses id="send-money-addCountry" for the Add Country step and
    // id="send-money-country-selection" for the dropdown inside it
    const countrySelector = this.page
      .locator('#send-money-addCountry, #send-money-country-selection')
      .first();
    const idFound = await countrySelector.isVisible().catch(() => false);
    if (idFound) {
      await countrySelector.click({ force: true });
    } else {
      await this.page.locator('[class*="country"], select[name*="country"]').first().click({ force: true });
    }
    await this.page.getByText(country, { exact: false }).first().click();
  }

  async enterSendAmount(amount: string): Promise<void> {
    // CP converter widget is id="send-money-coverter-box" (note typo in source)
    // Inputs within it are standard input elements
    const input = this.page
      .locator('#send-money-coverter-box input, input[name*="amount"], input[placeholder*="amount" i]')
      .first();
    await input.waitFor({ state: 'visible', timeout: 10_000 });
    await input.click({ clickCount: 3 });
    await input.fill(amount);
  }

  async selectTransferMethod(method: string): Promise<void> {
    const btn = this.page
      .locator('button, [role="radio"], [class*="option"]')
      .filter({ hasText: new RegExp(method, 'i') })
      .first();
    await btn.click({ force: true });
  }

  async selectRecipient(name: string): Promise<void> {
    // CP uses id="send-money-recipientList" for the recipient list; items inside use class matching
    const recipientEl = this.page
      .locator('#send-money-recipientList [class*="recipient"], [class*="recipient"]')
      .filter({ hasText: name })
      .first();
    await recipientEl.click({ force: true });
  }

  async clickAddNewRecipient(): Promise<void> {
    await this.page
      .locator('button:has-text("Add"), button:has-text("New recipient"), button:has-text("Add recipient")')
      .first()
      .click();
  }

  async clickContinue(): Promise<void> {
    // CP uses id="continue" (TransferConversion step) or id="payment-type-continue" (payment step)
    const btn = this.page.locator('#continue, #payment-type-continue').first();
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
    // CP uses id="create-transaction" for the final confirm/send button
    const btn = this.page.locator('#create-transaction').first();
    const found = await btn.isVisible().catch(() => false);
    if (found) {
      await btn.click({ force: true });
    } else {
      await this.page
        .locator('button:has-text("Confirm"), button:has-text("Send")')
        .first()
        .click({ force: true });
    }
  }

  async assertOrderConfirmation(): Promise<void> {
    // CP uses id="transfer-summary" on the summary/confirmation page
    const confirmation = this.page
      .locator('#transfer-summary, #recipient-summary')
      .or(this.page.getByText(/transfer submitted|order placed|success/i))
      .first();
    await confirmation.waitFor({ state: 'visible', timeout: 20_000 });
  }

  async assertTransferRate(): Promise<void> {
    // CP uses id="send-money-coverter-box" for the exchange-rate/converter widget
    const rate = this.page
      .locator('#send-money-coverter-box, [class*="rate"], [class*="Rate"]')
      .first();
    await rate.waitFor({ state: 'visible' });
    await expect(rate).toBeVisible();
  }

  async assertFee(): Promise<void> {
    const fee = this.page
      .locator('[class*="fee"], [class*="Fee"]')
      .first();
    await fee.waitFor({ state: 'visible' });
    await expect(fee).toBeVisible();
  }

  async assertComplianceNotification(): Promise<void> {
    await expect(
      this.page.locator('#transfer-detail-compliance-notification').first()
    ).toBeVisible({ timeout: 15_000 });
  }

  async dismissExtraAmountDialog(): Promise<void> {
    // CP shows id="extra-amount-dialog" with id="got-it" dismiss button
    const dialog = this.page.locator('#extra-amount-dialog');
    const visible = await dialog.isVisible().catch(() => false);
    if (visible) {
      await this.page.locator('#got-it').click({ force: true });
      await dialog.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
    }
  }

  async selectPaymentMethod(method: string): Promise<void> {
    const btn = this.page
      .locator('[class*="payment"], [class*="Payment"]')
      .filter({ hasText: new RegExp(method, 'i') })
      .first();
    await btn.click({ force: true });
  }

  async assertMinimumAmountError(): Promise<void> {
    const error = this.page
      .locator('[class*="error"], [class*="Error"]')
      .filter({ hasText: /minimum|at least/i })
      .first();
    await error.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(error).toBeVisible();
  }

  async assertMaximumAmountError(): Promise<void> {
    const error = this.page
      .locator('[class*="error"], [class*="Error"]')
      .filter({ hasText: /maximum|exceed|limit/i })
      .first();
    await error.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(error).toBeVisible();
  }
}
