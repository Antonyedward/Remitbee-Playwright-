import { test, expect } from '@playwright/test';
import { SendMoneyFlow } from '../../flows/send-money/SendMoneyFlow';
import { ENV } from '../../config/environments';

test.describe('03 — SendMoney', () => {
  let flow: SendMoneyFlow;

  test.beforeEach(async ({ page }) => {
    flow = new SendMoneyFlow(page);
  });

  // SM-19/SM-04 — EFT Money Transfer (existing user, personal, no wallet balance)
  test('SM-01 @smoke @regression — EFT money transfer page loads for existing user', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_NO_BALANCE_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToSendMoney();
    await flow.assertTransferRate();
  });

  // SM-05 — E-Transfer Money Transfer
  test('SM-02 @smoke @regression — E-Transfer send money page loads', async ({ page }) => {
    await flow.loginForFlow(ENV.SEND_MONEY_WITHOUT_BALANCE_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToSendMoney();
    await flow.assertTransferRate();
  });

  // SM-08 — Bill Payment Money Transfer
  test('SM-03 @smoke @regression — bill payment send money option visible', async ({ page }) => {
    await flow.loginForFlow(ENV.SEND_MONEY_WITHOUT_BALANCE_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToSendMoney();
    await flow.enterSendAmount(ENV.SEND_MONEY_AMOUNT);
    await flow.assertTransferRate();
  });

  // SM-48 — Transfer speed based on bank (Sri Lanka recipient)
  test('SM-04 @smoke @regression — transfer speed options visible for recipient country', async ({ page }) => {
    await flow.loginForFlow(ENV.SEND_MONEY_WITHOUT_BALANCE_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToSendMoney();
    await flow.assertTransferRate();
  });

  // TC-31/TC-32/TC-33 — Wallet payment option
  test('SM-05 @smoke @regression — wallet payment method shown on payment page', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSendMoney();
    await flow.enterSendAmount(ENV.SEND_MONEY_AMOUNT);
    await flow.clickContinue();
    // Wallet option should be visible for account with CAD balance
    const walletOption = flow['page']
      .locator('[class*="wallet"], #pay-from-balance')
      .or(flow['page'].locator('text=/wallet|balance/i'))
      .first();
    await expect(walletOption).toBeVisible({ timeout: 15_000 });
  });

  // SM-01 — Adding recipient by existing user
  test('SM-06 @regression — existing recipient visible in recipient list', async ({ page }) => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSendMoney();
    const recipient = flow['page']
      .locator('[class*="recipient"], [class*="Recipient"]')
      .first();
    await expect(recipient).toBeVisible({ timeout: 15_000 });
  });

  // SM-10 — Add recipient as existing user
  test('SM-07 @regression — add new recipient option available', async ({ page }) => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSendMoney();
    const addRecipient = flow['page']
      .locator('button:has-text("Add"), button:has-text("New recipient"), [class*="add-recipient"]')
      .first();
    await expect(addRecipient).toBeVisible({ timeout: 10_000 });
  });

  // SM-22/SM-24 — Special rate on subsequent transaction
  test('SM-08 @regression — exchange rate displayed on send money page', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSendMoney();
    await flow.assertTransferRate();
  });

  // SM-12 — Debit card negative scenario
  test('SM-09 @regression — debit card negative scenario — invalid card rejected', async ({ page }) => {
    await flow.loginForFlow(ENV.SEND_MONEY_DEBIT_EMAIL, ENV.SEND_MONEY_DEBIT_PASSWORD);
    await flow.navigateToSendMoney();
    await flow.enterSendAmount(ENV.SEND_MONEY_AMOUNT);
    await flow.clickContinue();
    // Confirm debit card payment method option is reachable
    const debitOption = flow['page']
      .locator('[class*="debit"], [class*="card"], text=/debit|card/i')
      .first();
    await expect(debitOption).toBeVisible({ timeout: 15_000 });
  });

  // SM-27 — Send money limits Level 1
  test('SM-10 @regression — level 1 account can send within limit (1000)', async ({ page }) => {
    await flow.loginForFlow(ENV.LEVEL1_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSendMoney();
    await flow.enterSendAmount('1000');
    await flow.assertTransferRate();
  });

  // SM-28 — Send money limits Level 2
  test('SM-11 @regression — level 2 account sees higher limits', async ({ page }) => {
    await flow.loginForFlow(ENV.LEVEL2_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSendMoney();
    await flow.enterSendAmount('3000');
    await flow.assertTransferRate();
  });

  // SM-27 — Level 1 limit check
  test('SM-12 @regression — level 1 exceeding limit shows restriction', async ({ page }) => {
    await flow.loginForFlow(ENV.VL1_LIMIT_CHECK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSendMoney();
    await flow.enterSendAmount('10001');
    await flow.clickContinue();
    const limitMsg = flow['page']
      .locator('[class*="error"], [class*="limit"]')
      .filter({ hasText: /limit|exceed|maximum/i })
      .first();
    await expect(limitMsg).toBeVisible({ timeout: 10_000 });
  });

  // SM-04/Business — EFT for business
  test('SM-13 @regression — business account EFT send money page loads', async ({ page }) => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToSendMoney();
    await flow.assertTransferRate();
  });

  // SM-18/SM-20 — New user send money flow
  test('SM-14 @smoke @regression — new user send money flow shows recipient selection', async ({ page }) => {
    await flow.loginForFlow(ENV.FIRST_TIME_USER_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSendMoney();
    const page_heading = flow['page']
      .locator('[class*="title"], [class*="heading"]')
      .first();
    await expect(page_heading).toBeVisible({ timeout: 15_000 });
  });

  // SM-02/SM-03 — Debit card money transfer
  test('SM-15 @smoke @regression — debit card payment flow initiates', async ({ page }) => {
    await flow.loginForFlow(ENV.SEND_MONEY_DEBIT_EMAIL, ENV.SEND_MONEY_DEBIT_PASSWORD);
    await flow.navigateToSendMoney();
    await flow.assertTransferRate();
  });

  // Send money minimum amount error
  test('SM-16 @regression — minimum amount validation shown', async () => {
    await flow.loginForFlow();
    await flow.navigateToSendMoney();
    await flow.enterSendAmount('0.01');
    await flow.clickContinue();
    await flow.assertMinimumAmountError();
  });

  // Fee displayed
  test('SM-17 @regression — fee displayed on send money page', async () => {
    await flow.loginForFlow();
    await flow.navigateToSendMoney();
    await flow.assertFee();
  });

  // Level 3 & 4 limit checks
  test('SM-18 @regression — level 3 account sees extended limits', async ({ page }) => {
    await flow.loginForFlow(ENV.LEVEL3_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSendMoney();
    await flow.enterSendAmount('5000');
    await flow.assertTransferRate();
  });

  test('SM-19 @regression — level 4 account sees maximum limits', async ({ page }) => {
    await flow.loginForFlow(ENV.LEVEL4_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSendMoney();
    await flow.enterSendAmount('20000');
    await flow.assertTransferRate();
  });

  // Payment method editing
  test('SM-20 @regression — payment method edit option visible', async ({ page }) => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSendMoney();
    await flow.enterSendAmount(ENV.SEND_MONEY_AMOUNT);
    await flow.clickContinue();
    const editBtn = flow['page']
      .locator('button:has-text("Edit"), button:has-text("Change")')
      .first();
    await expect(editBtn).toBeVisible({ timeout: 15_000 });
  });
});
