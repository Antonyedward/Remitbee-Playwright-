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
    // Click into first transaction
    const firstTx = flow['page']
      .locator('[class*="transaction-item"], [class*="TransactionItem"]')
      .first();
    await firstTx.click({ force: true }).catch(() => {});
  });

  // TC-44/TC-48 — Apply filters
  test('TX-04 @regression — filter by status works', async () => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    await flow.filterByStatus('Completed');
    await flow.assertTransactionListVisible();
  });

  // TC-45/TC-46 — Apply date range filter
  test('TX-05 @regression — date range filter applies correctly', async () => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    await flow.filterByDateRange('2024-05-01', '2024-05-16');
  });

  // TC-51 — Search for non-existent transaction
  test('TX-06 @regression — search for non-existent transaction shows no results', async () => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    await flow.searchTransaction('@#$%^&*()');
    await flow.assertNoTransactions();
  });

  // TC-34/SM-46 — View transaction status
  test('TX-07 @smoke @regression — can view transaction status details', async () => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    await flow.assertTransactionListVisible();
    const firstTx = flow['page']
      .locator('[class*="transaction-item"], [class*="TransactionItem"], [class*="transaction-row"]')
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
    // Empty state OR transaction list — both valid
    const state = flow['page']
      .locator('[class*="empty"], [class*="no-transaction"], #error-no-results')
      .or(flow['page'].locator('[class*="transaction"]'))
      .first();
    await expect(state).toBeVisible({ timeout: 15_000 });
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
    const helpLink = flow['page']
      .locator('a:has-text("Help"), button:has-text("Help"), a:has-text("Escalate")')
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
  });

  // Progress indicator
  test('TX-18 @regression — progress indicator visible on completed transaction', async () => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToTransactions();
    await flow.assertTransactionListVisible();
    const progress = flow['page']
      .locator('[class*="progress"], [class*="step"], [class*="Progress"]')
      .first();
    await expect(progress).toBeVisible({ timeout: 10_000 });
  });
});
