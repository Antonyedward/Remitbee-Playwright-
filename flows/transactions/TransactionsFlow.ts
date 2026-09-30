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

  /** Transaction rows (TransactionList.tsx id="transaction-<id>"; day groups are "transaction-<date>-container"). */
  rows() {
    // Scoped to the list: the page heading is also id="transaction-history".
    return this.page.locator('#transactions-container [id^="transaction-"]:not([id$="-container"]):visible');
  }

  noResults() {
    // TransactionsWizard.tsx Splash: "No search results found"
    return this.page.getByRole('heading', { name: /no search results found/i });
  }

  /**
   * FiltersDialog.tsx: #filters opens the dialog; status is a multi-select DropDown
   * (button#select-recipient → li[id="<label>"]); date chips #lastMonth #lastQuarter
   * #lastSixMonths #lastYear; #applyFilters applies and closes.
   */
  async openFilters(): Promise<void> {
    await this.page.locator('#filters').click();
    await expect(this.page.locator('#filters-dialog-header')).toBeVisible({ timeout: 15_000 });
  }

  async applyFilters(): Promise<void> {
    const apply = this.page.locator('#applyFilters');
    await expect(apply).toBeEnabled({ timeout: 10_000 });
    await apply.click();
    await expect(this.page.locator('#filters-dialog-header')).toBeHidden({ timeout: 15_000 });
    await expect(this.page.locator('#filters')).toHaveText(/Filters\s*\(\d+\)/, { timeout: 15_000 });
    await this.waitForResults();
  }

  /** Wait until the list shows rows or the no-results splash (loading skeleton gone). */
  async waitForResults(): Promise<void> {
    await expect(this.rows().first().or(this.noResults())).toBeVisible({ timeout: 45_000 });
  }

  /**
   * Jam 42edbdde: Filters → open the status dropdown → tick one or more statuses → Apply filters.
   * URL becomes ?transaction_status=COMPLETED&transaction_status=... and the button reads "Filters (1)".
   * Recipient AND status filters both use DropDown id="select-recipient" — pick the status one by its text.
   */
  async filterByStatuses(statuses: string[]): Promise<void> {
    await this.openFilters();
    const field = this.page.locator('button#select-recipient')
      .filter({ hasText: /select transaction status|in progress|completed|cancelled|pending|failed|scheduled|expired/i });
    for (const status of statuses) {
      const option = this.page.locator(`li[id="${status}"]`);
      await expect(async () => {
        if (!(await option.isVisible().catch(() => false))) await field.click();
        await option.click({ timeout: 5_000 });
        await expect(field).toContainText(status, { timeout: 3_000 });
      }).toPass({ timeout: 20_000, intervals: [500, 1_000] });
    }
    await this.page.locator('#filters-dialog-header').click(); // close the dropdown list
    await this.applyFilters();
  }

  async filterByStatus(status: string): Promise<void> {
    await this.filterByStatuses([status]);
  }

  /** Filters → "Clear all filters" (#clearFilters) — back to /transactions with no query. */
  async clearAllFilters(): Promise<void> {
    await this.openFilters();
    await this.page.locator('#clearFilters').click();
    await expect(this.page).toHaveURL(/\/transactions\/?$/, { timeout: 15_000 });
    await expect(this.page.locator('#filters')).not.toHaveText(/\(\d+\)/, { timeout: 15_000 });
  }

  /** chip: 'lastMonth' | 'lastQuarter' | 'lastSixMonths' | 'lastYear' */
  async filterByDateChip(chip: string): Promise<void> {
    await this.openFilters();
    await this.page.locator(`#${chip}`).click();
    await this.applyFilters();
  }

  /** Kept for older callers — the date filter is now chip-based (Last month/quarter/6 months/year). */
  async filterByDateRange(_from: string, _to: string): Promise<void> {
    await this.filterByDateChip('lastYear');
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
    // Search/filter with no match → Splash "No search results found" + "Clear filters"
    await expect(this.noResults()).toBeVisible({ timeout: 30_000 });
    await expect(this.rows()).toHaveCount(0);
  }

  /** SectionHeader.tsx button id="download" opens Dialog id="download-transactions" (CSV / PDF). */
  async clickDownloadTransactions(): Promise<void> {
    await this.page.locator('#download:visible').first().click();
    await expect(this.page.locator('#download-transactions')).toBeVisible({ timeout: 15_000 });
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
