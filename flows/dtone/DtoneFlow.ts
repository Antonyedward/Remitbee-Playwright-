import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

export class DtoneFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  async navigateToDtone(): Promise<void> {
    await this.navigateSidebar('Top up');
    await this.page.waitForURL(/top.?up|dtone|mobile/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
  }

  async selectCountry(country: string): Promise<void> {
    // CP uses id="select-country-service" for the search/filter input in the country picker.
    // Individual country rows have id={countryId} (e.g. "NG" for Nigeria).
    // Strategy: type into the search input to filter the list, then click the matching row.
    const searchInput = this.page.locator('#select-country-service').first();
    const searchVisible = await searchInput.isVisible().catch(() => false);
    if (searchVisible) {
      await searchInput.fill(country);
      await this.page.waitForTimeout(300);
    }
    // Click the first visible country row that contains the country text
    const countryItem = this.page
      .locator('[class*="country"], [class*="Country"]')
      .filter({ hasText: new RegExp(country, 'i') })
      .first();
    const itemVisible = await countryItem.isVisible().catch(() => false);
    if (itemVisible) {
      await countryItem.click({ force: true });
    } else {
      await this.page.getByText(country, { exact: false }).first().click();
    }
  }

  async enterPhoneNumber(phone: string): Promise<void> {
    // The phone step heading is id="enter-phone-number-title"
    // The actual phone input is a standard tel input below that heading
    const input = this.page
      .locator('input[type="tel"], input[name*="phone"], input[placeholder*="phone" i], input[inputmode="numeric"]')
      .first();
    await input.waitFor({ state: 'visible', timeout: 15_000 });
    await input.fill(phone);
  }

  async selectOperator(operator: string): Promise<void> {
    const op = this.page
      .locator('[class*="operator"], [class*="Operator"]')
      .filter({ hasText: new RegExp(operator, 'i') })
      .first();
    await op.click({ force: true });
  }

  async selectTopUpAmount(amount: string): Promise<void> {
    const amtBtn = this.page
      .locator('[class*="amount-option"], [class*="AmountOption"]')
      .filter({ hasText: amount })
      .first();
    await amtBtn.click({ force: true });
  }

  async enterCustomAmount(amount: string): Promise<void> {
    const input = this.page.locator('input[name*="amount"], input[placeholder*="amount" i], input[placeholder*="custom" i]').first();
    await input.fill(amount);
  }

  async assertPhoneNumberTitle(): Promise<void> {
    // CP uses id="enter-phone-number-title" for the phone entry step heading
    await expect(this.page.locator('#enter-phone-number-title').first()).toBeVisible({ timeout: 10_000 });
  }

  async assertProductTitle(): Promise<void> {
    // CP uses id="select-product-title" for the product/amount selection step heading
    await expect(this.page.locator('#select-product-title').first()).toBeVisible({ timeout: 10_000 });
  }

  async clickContinue(): Promise<void> {
    // CP uses id="continue" generically, or id="carrier-cahnge-continue" (note typo in source)
    // when changing carrier on the DTone wizard
    const btn = this.page
      .locator('#continue, #carrier-cahnge-continue')
      .first();
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
    // CP uses id="confirm-dialog" section; the Confirm button is inside it
    const confirmDialog = this.page.locator('#confirm-dialog');
    const inDialog = confirmDialog.locator('button').first();
    const dialogVisible = await confirmDialog.isVisible().catch(() => false);
    if (dialogVisible) {
      await inDialog.click({ force: true });
    } else {
      await this.page
        .locator('button:has-text("Confirm"), button:has-text("Pay")')
        .first()
        .click({ force: true });
    }
  }

  async assertTopUpSuccess(): Promise<void> {
    // CP shows id="confirm-dialog" with success state, or generic success
    const success = this.page
      .locator('#confirm-dialog, [class*="success"]')
      .or(this.page.getByText(/top.?up.*success|sent|success/i))
      .first();
    await success.waitFor({ state: 'visible', timeout: 25_000 });
    await expect(success).toBeVisible();
  }

  async assertTopUpSummary(): Promise<void> {
    const summary = this.page.locator('[class*="summary"], [class*="Summary"]').first();
    await summary.waitFor({ state: 'visible' });
    await expect(summary).toBeVisible();
  }

  async assertInvalidPhoneError(): Promise<void> {
    const error = this.page
      .locator('[class*="error"]')
      .filter({ hasText: /invalid|phone|number/i })
      .first();
    await error.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(error).toBeVisible();
  }
}
