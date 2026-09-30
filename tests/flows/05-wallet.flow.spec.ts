import { test, expect } from '@playwright/test';
import { WalletFlow } from '../../flows/wallet/WalletFlow';
import { ENV } from '../../config/environments';

test.describe('05 — Wallet / CAD Balance', () => {
  let flow: WalletFlow;

  test.beforeEach(async ({ page }) => {
    flow = new WalletFlow(page);
  });

  // CADB-01 — Account with CAD balance shows balance
  test('CADB-01 @smoke @regression — account with CAD balance shows balance on wallet page', async () => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.assertWalletBalance();
  });

  // CADB-02 — Account without CAD balance still loads the balance page
  test('CADB-02 @regression — account without CAD balance shows zero or empty state', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_NO_BALANCE_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToWallet();
    await expect(page.locator('#balance-details')).toBeVisible();
    // Deposit is always available (disabled: false in pages/balance/index.js)
    await expect(page.locator('#balance-deposit')).toBeEnabled();
  });

  // CADB-03 — Deposit flow opens from the balance page
  test('CADB-03 @smoke @regression — deposit to balance button visible for user with balance', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await expect(page.locator('#balance-deposit')).toBeVisible();
    await flow.clickDeposit(); // lands on /balance-deposit/amount with #amount input
    await expect(page.locator('input#amount')).toBeVisible();
  });

  // CADB-04 — Withdraw flow opens for a user with balance
  test('CADB-04 @regression — withdraw option visible for user with sufficient CAD balance', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.clickWithdraw(); // lands on /balance-withdrawal/withdrawal-details
    await expect(page.locator('input#amount')).toBeVisible();
  });

  // CADB-05 — Deposit: amount → deposit method step
  test('CADB-05 @smoke @regression — deposit EFT flow initiates', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.clickDeposit();
    await flow.enterDepositAmount('100');
    await flow.continueFromAmount();
    await flow.assertDepositMethodStep();
    await expect(page.getByText(/^Direct withdrawal \(EFT\)$/i).first()).toBeVisible();
  });

  // CADB-06 — Deposit by bank (EFT): method → bank step
  test('CADB-06 @regression — deposit to bank flow initiates', async () => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.clickDeposit();
    await flow.enterDepositAmount('10');
    await flow.continueFromAmount();
    await flow.selectDepositPaymentMethod('Direct withdrawal (EFT)');
    // Saved banks → /bank-details/eft-bank-list; none → /bank-details/eft-new-bank-selection
    await flow.waitForEftBankStep();
  });

  // CADB-07 — Withdraw less than minimum amount
  test('CADB-07 @regression — withdraw amount less than minimum shows error', async () => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.clickWithdraw();
    await flow.enterDepositAmount('5'); // below the $10 minimum (CAD_LESS_AMOUNT in .env isn't wired into ENV)
    await flow.assertAmountError(/minimum withdrawal amount is \$10/i);
  });

  // CADB-08 — The balance page no longer shows a sending limit (no "limit" text anywhere in
  // pages/balance or BalanceFullCard — checked 2026-09-30). Verify the wallet actions instead.
  test('CADB-08 @regression — wallet page shows deposit, withdraw and exchange actions', async () => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.assertWalletActions();
  });

  // CADB-09 — Deposit above the maximum ($500,000 per Amount.tsx — not $50,000)
  test('CADB-09 @regression — deposit amount exceeding sending limit shows error', async () => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.clickDeposit();
    await flow.enterDepositAmount('500001');
    await flow.assertAmountError(/maximum depositing amount is \$500,000/i);
  });

  // CADB-10 — Account with saved bank: EFT deposit shows the saved-bank list
  test('CADB-10 @regression — account with saved bank shows bank on deposit page', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToWallet();
    await flow.clickDeposit();
    await flow.enterDepositAmount('100');
    await flow.continueFromAmount();
    await flow.selectDepositPaymentMethod('Direct withdrawal (EFT)');
    expect(await flow.waitForEftBankStep()).toBe('eft-bank-list');
    await expect(page.locator('#eft-bank-select').first()).toBeVisible({ timeout: 15_000 });
  });

  // CADB-11 — Low balance account still shows wallet page
  test('CADB-11 @regression — low balance account still shows wallet page', async () => {
    await flow.loginForFlow(ENV.CAD_LOW_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.assertWalletBalance();
  });

  // Wallet currency
  test('CADB-12 @regression — wallet shows supported currencies', async () => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.assertWalletCurrencies();
  });

  // Deposit request (e-Transfer) — creates a pending deposit request on staging
  test('CADB-13 @smoke @regression — deposit to balance success dialog appears', async () => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.clickDeposit();
    await flow.completeETransferDeposit('100');
    await flow.assertDepositSuccess();
  });

  // Withdrawal — submits a real withdrawal request on staging
  test('CADB-14 @regression — withdraw from wallet success dialog appears', async () => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.clickWithdraw();
    await flow.completeWithdrawal(ENV.CAD_WITHDRAW_AMOUNT);
    await flow.assertWithdrawSuccess();
  });
});
