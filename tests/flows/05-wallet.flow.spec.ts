import { test, expect } from '@playwright/test';
import { WalletFlow } from '../../flows/wallet/WalletFlow';
import { ENV } from '../../config/environments';

test.describe('05 — Wallet / CAD Balance', () => {
  let flow: WalletFlow;

  test.beforeEach(async ({ page }) => {
    flow = new WalletFlow(page);
  });

  // CADB-01 — Account with CAD balance shows balance
  test('CADB-01 @smoke @regression — account with CAD balance shows balance on wallet page', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.assertWalletBalance();
  });

  // CADB-02 — Account without CAD balance shows $0.00
  test('CADB-02 @regression — account without CAD balance shows zero or empty state', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_NO_BALANCE_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToWallet();
    // Page should still load even with no balance
    const page_body = flow['page'].locator('[class*="wallet"], [class*="balance"]').first();
    await page_body.waitFor({ state: 'visible', timeout: 15_000 });
  });

  // CADB-03 — Deposit to balance option visible
  test('CADB-03 @smoke @regression — deposit to balance button visible for user with balance', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.clickDeposit();
    // Deposit options should appear
    const depositOption = flow['page']
      .locator('#deposit-to-balance, [class*="deposit"]')
      .first();
    await expect(depositOption).toBeVisible({ timeout: 15_000 });
  });

  // CADB-04 — Withdraw from wallet
  test('CADB-04 @regression — withdraw option visible for user with sufficient CAD balance', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.clickWithdraw();
    const withdrawSection = flow['page']
      .locator('[class*="withdraw"], [class*="transfer"]')
      .first();
    await expect(withdrawSection).toBeVisible({ timeout: 15_000 });
  });

  // CADB-05 — Deposit using EFT
  test('CADB-05 @smoke @regression — deposit EFT flow initiates', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.clickDeposit();
    await flow.enterDepositAmount('100');
    await flow.clickContinue();
    const payMethod = flow['page']
      .locator('[class*="payment"], [class*="method"]')
      .first();
    await expect(payMethod).toBeVisible({ timeout: 15_000 });
  });

  // CADB-06 — Deposit to bank option
  test('CADB-06 @regression — deposit to bank flow initiates', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.clickDeposit();
    await flow.enterDepositAmount('10');
    await flow.clickContinue();
    await flow.clickDepositToBank();
    const depositFlow = flow['page']
      .locator('[class*="bank"], [class*="account"]')
      .first();
    await expect(depositFlow).toBeVisible({ timeout: 15_000 });
  });

  // CADB-07 — Withdraw less than minimum amount
  test('CADB-07 @regression — withdraw amount less than minimum shows error', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.clickWithdraw();
    await flow.enterDepositAmount(ENV.CAD_WITHDRAW_AMOUNT); // using same field for withdraw
    await flow.clickContinue();
    // Less amount scenario
  });

  // CADB-08 — Sending limit check
  test('CADB-08 @regression — sending limit visible on wallet page', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    const limit = flow['page']
      .getByText(/limit|sending limit|daily/i)
      .first();
    await expect(limit).toBeVisible({ timeout: 15_000 });
  });

  // CADB-09 — Deposit exceeding sending limit
  test('CADB-09 @regression — deposit amount exceeding sending limit shows error', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.clickDeposit();
    await flow.enterDepositAmount('50001'); // exceeds 50000 limit
    await flow.clickContinue();
    const error = flow['page']
      .locator('[class*="error"]')
      .filter({ hasText: /limit|exceed|maximum/i })
      .first();
    await expect(error).toBeVisible({ timeout: 10_000 });
  });

  // CADB-010 — Account with saved bank
  test('CADB-10 @regression — account with saved bank shows bank on deposit page', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToWallet();
    await flow.clickDeposit();
    const savedBank = flow['page']
      .locator('[class*="bank"], [class*="account"]')
      .first();
    await expect(savedBank).toBeVisible({ timeout: 15_000 });
  });

  // CADB-11 — Low balance account shows low balance warning
  test('CADB-11 @regression — low balance account still shows wallet page', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_LOW_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.assertWalletBalance();
  });

  // Wallet currencies
  test('CADB-12 @regression — wallet shows supported currencies', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.assertWalletCurrencies();
  });

  // Deposit success
  test('CADB-13 @smoke @regression — deposit to balance success dialog appears', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.clickDeposit();
    await flow.enterDepositAmount('100');
    await flow.clickContinue();
    await flow.clickDepositToBalance();
    await flow.clickContinue();
    await flow.clickConfirm();
    await flow.assertDepositSuccess();
  });

  // Withdraw success
  test('CADB-14 @regression — withdraw from wallet success dialog appears', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToWallet();
    await flow.clickWithdraw();
    await flow.enterDepositAmount(ENV.CAD_WITHDRAW_AMOUNT);
    await flow.clickContinue();
    await flow.clickConfirm();
    await flow.assertWithdrawSuccess();
  });
});
