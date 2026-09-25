import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

export class TransactionsFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  async navigateToTransactions(): Promise<void> {
    await this.navigateSidebar('Transactions');  // resolves to /transactions
    await this.page.waitForURL(/\/transactions/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
  }

  async assertTransactionListVisible(): Promise<void> {
    // CP uses id="transactions-container" for the main transactions list wrapper
    const list = this.page
      .locator('#transactions-container, [class*="transaction"], [class*="Transaction"]')
      .first();
    await list.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(list).toBeVisible();
  }

  async filterByStatus(status: string): Promise<void> {
    // CP uses id="filters" for the Filter button (desktop)
    const filterBtn = this.page.locator('#filters').first();
    const found = await filterBtn.isVisible().catch(() => false);
    if (found) {
      await filterBtn.click({ force: true });
    } else {
      await this.page.locator('[class*="filter"], [class*="Filter"]').first().click({ force: true });
    }
    await this.page.getByText(status, { exact: false }).first().click();
    // Apply the filter using id="applyFilters" (desktop) or id="apply-filters" (mobile)
    const applyBtn = this.page.locator('#applyFilters, #apply-filters').first();
    const applyVisible = await applyBtn.isVisible().catch(() => false);
    if (applyVisible) await applyBtn.click({ force: true });
  }

  async filterByDateRange(from: string, to: string): Promise<void> {
    const fromInput = this.page.locator('input[name*="from"], input[placeholder*="from" i]').first();
    await fromInput.fill(from);
    const toInput = this.page.locator('input[name*="to"], input[placeholder*="to" i]').first();
    await toInput.fill(to);
  }

  async clickTransaction(index: number = 0): Promise<void> {
    // Each transaction item has id="transaction-{id}" — select by id prefix pattern
    const items = this.page.locator('[id^="transaction-"]');
    const count = await items.count().catch(() => 0);
    if (count > index) {
      await items.nth(index).click({ force: true });
    } else {
      // Fallback: class-based matching (CP uses rb-transactionList-box variants)
      await this.page
        .locator('[class*="rb-transactionList-box"], [class*="transaction-item"], [class*="TransactionItem"]')
        .nth(index)
        .click({ force: true });
    }
  }

  async assertTransactionDetailVisible(): Promise<void> {
    const detail = this.page
      .locator('[class*="detail"], [class*="Detail"]')
      .or(this.page.locator('[role="dialog"]'))
      .first();
    await detail.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(detail).toBeVisible();
  }

  async searchTransaction(query: string): Promise<void> {
    // CP uses id="search-transactions" for the search input
    const searchInput = this.page.locator('#search-transactions').first();
    const idFound = await searchInput.isVisible().catch(() => false);
    if (idFound) {
      await searchInput.fill(query);
    } else {
      await this.page.locator('input[type="search"], input[placeholder*="search" i]').first().fill(query);
    }
  }

  async assertNoTransactions(): Promise<void> {
    // CP uses id="error-no-results" when no transactions match the filter
    const empty = this.page
      .locator('#error-no-results')
      .or(this.page.getByText(/no transactions|nothing here|empty/i))
      .first();
    await empty.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(empty).toBeVisible();
  }

  async clickDownloadTransactions(): Promise<void> {
    // CP uses id="download-transactions" for the download button
    await this.page.locator('#download-transactions').first().click({ force: true });
  }

  async assertCancelledDialog(): Promise<void> {
    // CP uses id="transaction-cancelled" after successful cancellation
    await expect(this.page.locator('#transaction-cancelled').first()).toBeVisible({ timeout: 10_000 });
  }

  async cancelTransaction(): Promise<void> {
    // CP uses id="cancel" for the Cancel button in TransactionDetailsCard
    const cancelBtn = this.page
      .locator('#cancel, button:has-text("Cancel transfer"), button:has-text("Cancel")')
      .first();
    await cancelBtn.click({ force: true });
    // CP uses id="confirm-cancellation" for the confirm step
    const confirmBtn = this.page.locator('#confirm-cancellation, button:has-text("Yes"), button:has-text("Confirm")').first();
    await confirmBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await confirmBtn.click();
    // Wait for cancellation dialog id="transaction-cancelled"
    await this.page.locator('#transaction-cancelled').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
  }
}
