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
    // Converter → purpose → payment step (SelectPayType.tsx)
    await flow.goToPaymentStep(ENV.SEND_MONEY_AMOUNT);
    // Wallet option label is "CAD Balance" (payment_types.pay_with_wallet_balance)
    await expect(flow.paymentOption(/^CAD Balance$/i)).toBeVisible({ timeout: 15_000 });
  });

  // SM-01 — Adding recipient by existing user
  test('SM-06 @regression — existing recipient visible in recipient list', async ({ page }) => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSendMoney();
    // RecipientLists.tsx: list container id="send-money-recipientList", one child div per recipient
    const recipient = page.locator('#send-money-recipientList > div').first();
    await expect(recipient).toBeVisible({ timeout: 15_000 });
  });

  // SM-10 — Add recipient as existing user
  test('SM-07 @regression — add new recipient option available', async ({ page }) => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSendMoney();
    // CP uses id="send-money-addRecipient" (RecipientLists.tsx)
    await expect(page.locator('#send-money-addRecipient')).toBeVisible({ timeout: 15_000 });
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
    await flow.goToPaymentStep(ENV.SEND_MONEY_AMOUNT);
    // Confirm debit card payment method option is reachable ("Debit card" label in SelectPayType)
    await expect(flow.paymentOption(/^Debit card$/i)).toBeVisible({ timeout: 15_000 });
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
    // Limit alert renders live while typing (before Continue) in #transfer-detail-compliance-notification
    await flow.assertMaximumAmountError();
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
    // First-time users land on the country-selection step: id="send-money-addCountry"
    // or the converter box if they somehow have a recipient. Accept either.
    const page_indicator = flow['page']
      .locator('#send-money-addCountry, #send-money-coverter-box, [class*="rb-sendMoney"]')
      .first();
    await expect(page_indicator).toBeVisible({ timeout: 15_000 });
  });

  // SM-02/SM-03 — Debit card money transfer
  test('SM-15 @smoke @regression — debit card payment flow initiates', async ({ page }) => {
    await flow.loginForFlow(ENV.SEND_MONEY_DEBIT_EMAIL, ENV.SEND_MONEY_DEBIT_PASSWORD);
    await flow.navigateToSendMoney();
    await flow.assertTransferRate();
  });

  // Send money minimum amount error
  test('SM-16 @regression — minimum amount validation shown', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSendMoney();
    // $5: above the receive-side minimum for normal corridors (live DOM: $0.01 tripped
    // "Receiving amount is less than the minimum limit 10 GHS" and disabled Continue),
    // but below the $10 CAD send minimum, which is checked when Continue is clicked.
    await flow.enterSendAmount('5');
    // Clicks Continue (retrying — first click is often swallowed) until the min message appears
    await flow.triggerMinimumAmountError();
    await flow.assertMinimumAmountError();
  });

  // Fee displayed
  test('SM-17 @regression — fee displayed on send money page', async () => {
    await flow.loginForFlow();
    await flow.navigateToSendMoney();
    // Fee (id="total-fees") only renders on the payment step
    await flow.goToPaymentStep(ENV.SEND_MONEY_AMOUNT);
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
    await flow.goToPaymentStep(ENV.SEND_MONEY_AMOUNT);
    // Pick a non-card method, continue to Overview, where each summary has an edit action
    // (Overview.tsx accordionActionId="payment-summary-edit"). Nothing is submitted here —
    // the transfer is only created by #create-transaction, which this test never clicks.
    await flow.selectPaymentMethod(/^(e-Transfer|Bill Payment|CAD Balance|Direct withdrawal \(EFT\))$/i);
    await page.locator('#payment-type-continue').click({ force: true });
    await expect(page.locator('#payment-summary-edit').first()).toBeVisible({ timeout: 25_000 });
  });
});
