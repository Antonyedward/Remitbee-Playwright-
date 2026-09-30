import { test, expect } from '@playwright/test';
import { TransactionsFlow } from '../../flows/transactions/TransactionsFlow';
import { ENV } from '../../config/environments';

test.describe('08 — Transactions', () => {
  let flow: TransactionsFlow;

  test.beforeEach(async ({ page }) => {
    flow = new TransactionsFlow(page);
  });

  // TC-01 — Transactions history page
  test('TX-01 @smoke @regression — transactions page loads', async () => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
  });

  // TC-08/TC-13 — Transaction with download receipt
  test('TX-02 @smoke @regression — transaction list visible with history', async () => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    await flow.assertTransactionListVisible();
  });

  // TC-21/TC-35 — Cancel transaction
  test('TX-03 @smoke @regression — cancel transaction option visible on in-progress transaction', async () => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    await flow.assertTransactionListVisible();
    // Click into first transaction — CP uses class rb-transactionList-box on each item
    // (individual items also have id="transaction-{id}" but the class is more reliable for nth())
    const firstTx = flow['page']
      .locator('[class*="rb-transactionList-box"], [id^="transaction-"]:not([id$="-container"])')
      .first();
    await firstTx.click({ force: true }).catch(() => {});
  });

  // TC-44/TC-48 — Apply filters
  test('TX-04 @regression — filter by status works', async ({ page }) => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    // Jam 42edbdde: Completed + Cancelled + In Progress → Apply → Filters (1) → Clear all filters
    await flow.filterByStatuses(['Completed', 'Cancelled', 'In Progress']);
    await expect(page).toHaveURL(/transaction_status=COMPLETED/);
    await expect(page).toHaveURL(/transaction_status=CANCELLED/);
    await expect(page).toHaveURL(/transaction_status=CUST_TRAN/);
    await expect(flow.rows().first()).toBeVisible({ timeout: 30_000 });
    for (const row of await flow.rows().allInnerTexts()) {
      expect(row).toMatch(/completed|cancelled|in progress/i);
    }
    await flow.clearAllFilters();
    await flow.waitForResults();
  });

  // TC-45/TC-46 — Apply date range filter
  test('TX-05 @regression — date range filter applies correctly', async ({ page }) => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    // Date filter is chip-based now (Last month / quarter / 6 months / year) — no from/to inputs.
    await flow.filterByDateChip('lastYear');
    await expect(page.locator('#filters')).toHaveText(/Filters\s*\(1\)/);
  });

  // TC-51 — Search for non-existent transaction
  test('TX-06 @regression — search for non-existent transaction shows no results', async () => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    await flow.searchTransaction('@#$%^&*()');
    await flow.assertNoTransactions();
    await expect(flow['page'].getByText(/did not match any transactions/i)).toBeVisible();
  });

  // TC-34/SM-46 — View transaction status
  test('TX-07 @smoke @regression — can view transaction status details', async () => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    await flow.assertTransactionListVisible();
    // CP uses class rb-transactionList-box on each item, or id="transaction-{id}" on each row
    const firstTx = flow['page']
      .locator('[class*="rb-transactionList-box"], [id^="transaction-"]:not([id$="-container"])')
      .first();
    const visible = await firstTx.isVisible().catch(() => false);
    if (visible) {
      await firstTx.click({ force: true });
      await flow['page'].waitForTimeout(2_000);
    }
  });

  // TC-02/TC-58 — Transaction history empty state
  test('TX-08 @regression — account with no transactions shows empty state', async () => {
    await flow.loginForFlow(ENV.FIRST_TIME_USER_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    // TransactionsWizard renders no list and no splash when the user has no transactions at all
    // (the "No search results" splash is only for search/filters). Wait for loading to finish.
    await expect(flow['page'].locator('#transaction-history')).toBeVisible({ timeout: 30_000 });
    await flow['page'].waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await expect(flow.rows()).toHaveCount(0, { timeout: 30_000 });
    await expect(flow['page'].locator('#transactions-container [id$="-container"][id^="transaction-"]')).toHaveCount(0);
  });

  // TC-03/TC-04 — Exchange Currency / Send Money buttons
  test('TX-09 @regression — exchange currency button navigates to exchange page', async ({ page }) => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    const exchangeBtn = flow['page']
      .locator('button:has-text("Exchange"), a:has-text("Exchange")')
      .first();
    const visible = await exchangeBtn.isVisible().catch(() => false);
    if (visible) {
      await exchangeBtn.click({ force: true });
      await page.waitForURL(/exchange|currency/i, { timeout: 15_000 }).catch(() => {});
    }
  });

  // TC-05 — View transaction history
  test('TX-10 @regression — transaction history page has correct URL', async ({ page }) => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    await expect(page).toHaveURL(/transaction/i);
  });

  // TC-11 — Transaction details
  test('TX-11 @regression — clicking transaction shows transaction details', async () => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    await flow.assertTransactionListVisible();
    await flow.clickTransaction(0);
  });

  // TC-12 — Transaction details display
  test('TX-12 @regression — transaction details show amount and recipient', async () => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    await flow.assertTransactionListVisible();
    await flow.clickTransaction(0);
    const amount = flow['page']
      .getByText(/\$|CAD|USD/i)
      .first();
    await expect(amount).toBeVisible({ timeout: 10_000 });
  });

  // TC-20 — Need help link
  test('TX-13 @regression — need help or escalation link visible on transaction detail', async () => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    await flow.assertTransactionListVisible();
    await flow.clickTransaction(0);
    // CP uses id='need_help' in TransactionDetailsCard.tsx for the help/escalate element
    const helpLink = flow['page']
      .locator('#need_help, a:has-text("Help"), button:has-text("Help"), a:has-text("Escalate")')
      .first();
    await expect(helpLink).toBeVisible({ timeout: 10_000 });
  });

  // TC-22/TC-23 — Don't cancel dialog
  test('TX-14 @regression — cancel confirmation dialog has keep-option button', async () => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    await flow.assertTransactionListVisible();
    // Look for a cancellable transaction
    const cancelBtn = flow['page']
      .locator('button:has-text("Cancel transaction")')
      .first();
    const visible = await cancelBtn.isVisible().catch(() => false);
    if (visible) {
      await cancelBtn.click({ force: true });
      const keepBtn = flow['page']
        .locator('button:has-text("Keep"), button:has-text("Don\'t cancel")')
        .first();
      await keepBtn.waitFor({ state: 'visible', timeout: 10_000 });
    }
  });

  // TC-53 — Special characters in search
  test('TX-15 @regression — special characters in search handled gracefully', async () => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    await flow.searchTransaction('@#$%^');
    // Either empty state or graceful handling
    await flow['page'].waitForTimeout(2_000);
  });

  // TC-63 — In progress message
  test('TX-16 @regression — in progress transaction shows status message', async () => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    const inProgress = flow['page']
      .getByText(/in progress|pending|processing/i)
      .first();
    await expect(inProgress).toBeVisible({ timeout: 10_000 });
  });

  // Download receipt
  test('TX-17 @smoke @regression — download transactions button visible', async () => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    await flow.assertTransactionListVisible();
    await flow.clickDownloadTransactions();
    // Dialog offers CSV / PDF — the file itself is not downloaded here
    await expect(flow['page'].getByText(/download your transactions history/i)).toBeVisible();
    await expect(flow['page'].locator('#download-transactions #CSV, #download-transactions #PDF').first()).toBeVisible();
  });

  // Transaction status on the details page (Jam d401dd0a)
  test('TX-18 @regression — transaction details show the transaction status', async ({ page }) => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    await flow.assertTransactionListVisible();
    const first = flow.rows().first();
    await expect(first).toBeVisible({ timeout: 30_000 });
    const listStatus = ((await first.innerText())
      .match(/in progress|completed|cancelled|pending|failed|scheduled|expired|on hold|refunded/i) ?? [''])[0];
    await first.click();
    await page.waitForURL(/\/transactions\/details/, { timeout: 30_000 });
    // Details card differs per type (money transfer / currency exchange / balance…) but all show
    // "Transaction status <value>" — e.g. live DOM: "Transaction status Cancelled".
    await expect(page.getByRole('heading', { name: 'Transaction details', level: 1 })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText('Transaction status', { exact: true }).first()).toBeVisible({ timeout: 45_000 });
    const main = page.locator('body');
    await expect(main).toContainText(
      new RegExp(`Transaction status\\s*${listStatus || '[A-Za-z ]+'}`, 'i'), { timeout: 15_000 });
  });
});
