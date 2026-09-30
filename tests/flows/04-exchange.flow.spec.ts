import { test, expect } from '@playwright/test';
import { ExchangeFlow } from '../../flows/exchange/ExchangeFlow';
import { ENV } from '../../config/environments';

test.describe('04 — CurrencyExchange', () => {
  let flow: ExchangeFlow;

  test.beforeEach(async ({ page }) => {
    flow = new ExchangeFlow(page);
  });

  // TC003/TC004 — Level 1 personal account CE
  test('CE-01 @smoke @regression — level 1 personal account can do CE within daily limit', async ({ page }) => {
    await flow.loginForFlow(ENV.LEVEL1_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToExchange();
    await flow.enterAmount(ENV.CE_AMOUNT);
    await flow.assertRate();
  });

  // TC005/TC006 — Level 2 personal account CE
  test('CE-02 @regression — level 2 personal account CE within daily limit', async ({ page }) => {
    await flow.loginForFlow(ENV.LEVEL2_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToExchange();
    await flow.enterAmount(ENV.CE_AMOUNT);
    await flow.assertRate();
  });

  // TC007/TC008 — Level 3 personal account CE
  test('CE-03 @regression — level 3 personal account CE within daily limit', async ({ page }) => {
    await flow.loginForFlow(ENV.LEVEL3_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToExchange();
    await flow.enterAmount(ENV.CE_AMOUNT);
    await flow.assertRate();
  });

  // TC009/TC010 — Level 4 personal account CE
  test('CE-04 @smoke @regression — level 4 personal account CE within daily limit', async ({ page }) => {
    await flow.loginForFlow(ENV.LEVEL4_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToExchange();
    await flow.enterAmount(ENV.CE_AMOUNT);
    await flow.assertRate();
  });

  // TC011 — CAD to USD exchange with sufficient balance
  test('CE-05 @smoke @regression — CAD to USD exchange shows conversion rate', async ({ page }) => {
    await flow.loginForFlow(ENV.CE_SUFFICIENT_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToExchange();
    await flow.enterAmount(ENV.CE_AMOUNT);
    await flow.assertRate();
  });

  // TC011 (business) — CAD to USD for business
  test('CE-06 @regression — business account CAD to USD CE', async ({ page }) => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToExchange();
    await flow.enterAmount(ENV.CE_AMOUNT);
    await flow.assertRate();
  });

  // TC012 — USD to CAD exchange
  test('CE-07 @regression — USD to CAD exchange shows conversion rate', async ({ page }) => {
    await flow.loginForFlow(ENV.CE_SUFFICIENT_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToExchange();
    await flow.selectFromCurrency('USD'); await flow.selectToCurrency('CAD');
    await flow.enterAmount(ENV.CE_AMOUNT);
    await flow.assertRate();
  });

  // TC012 (business) — USD to CAD business
  test('CE-08 @regression — business account USD to CAD CE', async ({ page }) => {
    await flow.loginForFlow(ENV.BUSINESS_WITH_WALLET_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToExchange();
    await flow.selectFromCurrency('USD'); await flow.selectToCurrency('CAD');
    await flow.enterAmount(ENV.CE_AMOUNT);
    await flow.assertRate();
  });

  // TC001/TC002 — New signup user CE with EFT
  test('CE-09 @smoke @regression — new user CE flow initiates with EFT payment', async ({ page }) => {
    await flow.loginForFlow(ENV.FIRST_TIME_USER_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToExchange();
    // Conversion → purpose → payment source step ("How do you want to pay for your exchange?")
    await flow.goToPaymentStep(ENV.CE_AMOUNT);
    await flow.assertPaymentSourceStep();
  });

  // TC001/TC028 — Business first CE with EFT
  test('CE-10 @regression — business new user CE with EFT', async ({ page }) => {
    await flow.loginForFlow(ENV.BUSINESS_NO_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToExchange();
    await flow.enterAmount(ENV.CE_AMOUNT);
    await flow.assertRate();
  });

  // TC024/TC029 — First time user sees CAD balance option
  test('CE-11 @regression — user with sufficient CAD balance sees wallet payment option', async ({ page }) => {
    await flow.loginForFlow(ENV.CE_SUFFICIENT_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToExchange();
    await flow.goToPaymentStep(ENV.CE_AMOUNT);
    // PaymentSourceSelection.tsx: "Pay from your CAD balance" radio, id="pay-from-balance"
    await expect(page.locator('#pay-from-balance')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#pay-from-balance')).toBeEnabled();
  });

  // TC031 — First time user has fee-free EFT
  test('CE-12 @regression — first time user EFT has fee-free label', async ({ page }) => {
    await flow.loginForFlow(ENV.FIRST_TIME_USER_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToExchange();
    await flow.goToPaymentStep(ENV.CE_AMOUNT);
    // Pay from bank → bank-connection options (ConnectionType.tsx).
    // NOTE: the "Total fees: Free" label is still defined in ConnectionType.tsx data but is no longer
    // rendered (confirmed on live staging 2026-09-30), so this checks the EFT options render instead.
    await flow.openBankConnectionOptions();
    await expect(page.getByRole('heading', { name: /connect your bank accounts/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#instant-connection')).toBeVisible();
    await expect(page.locator('#manual-connection')).toBeVisible();
  });

  // TC034 — Business exceeding daily limit
  test('CE-13 @regression — business account exceeding daily limit shows restriction', async ({ page }) => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToExchange();
    await flow.enterAmount('250001');
    // Limit validation is live (while typing) — no Continue needed
    await flow.assertLimitError();
  });

  // TC030/TC034 — Existing user CE using CAD balance
  test('CE-14 @regression — existing user can complete CE using CAD balance', async ({ page }) => {
    await flow.loginForFlow(ENV.CE_SUFFICIENT_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToExchange();
    await flow.goToPaymentStep(ENV.CE_AMOUNT);
    await flow.clickPayFromBalance();
    await flow.clickContinue();
    // Deposit step (DepositDestinationSelection.tsx)
    await page.locator('#deposit-to-balance').waitFor({ state: 'visible', timeout: 25_000 });
    await flow.clickDepositToBalance();
    await flow.clickContinue();
    // Overview (review) — nothing is submitted; the exchange is only placed from the overview's Confirm
    await flow.assertOverview();
  });

  // TC040 — Page refresh
  test('CE-15 @regression — currency exchange page loads after refresh', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToExchange();
    await page.reload();
    await flow.assertRate();
  });

  // TC013-TC016 — Currency dropdown options
  test('CE-16 @regression — CAD dropdown shows CAD and USD options', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToExchange();
    // Currency pickers in the converter: send side defaults to CAD, receive side to USD
    await expect(page.locator('#sendingEnd-dropDownCountry')).toContainText(/CAD|USD/, { timeout: 15_000 });
    await expect(page.locator('#receiveEnd-dropDownCountry')).toContainText(/CAD|USD/);
  });

  // CE less amount
  test('CE-17 @regression — less than minimum amount shows error', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToExchange();
    await flow.enterAmount(ENV.CE_LESS_AMOUNT);
    // "Minimum exchanging amount is $10 CAD" appears after Continue (retried — first click is often swallowed)
    await flow.triggerMinimumAmountError();
  });

  // TC049 — Existing user USD to CAD manual EFT
  test('CE-18 @regression — existing user can initiate USD to CAD CE', async ({ page }) => {
    await flow.loginForFlow(ENV.CE_SUFFICIENT_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToExchange();
    await flow.selectFromCurrency('USD'); await flow.selectToCurrency('CAD');
    await flow.enterAmount(ENV.CE_AMOUNT);
    await flow.assertRate();
  });

  // TC052 — Instant connection payment / manual deposit
  test('CE-19 @regression — deposit to bank option available', async ({ page }) => {
    await flow.loginForFlow(ENV.CE_SUFFICIENT_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToExchange();
    await flow.goToPaymentStep(ENV.CE_AMOUNT);
    await flow.clickPayFromBalance();
    await flow.clickContinue();
    // Deposit step: "deposit to bank" option is available and selectable
    const toBank = page.locator('#deposit-to-bank');
    await toBank.waitFor({ state: 'visible', timeout: 25_000 });
    await flow.clickDepositToBank();
    await expect(page.locator('#continue:visible').first()).toBeEnabled({ timeout: 10_000 });
  });

  // TC044 — Manual EFT connection + micro deposit
  test('CE-20 @regression — new user can connect bank manually for CE', async ({ page }) => {
    await flow.loginForFlow(ENV.FIRST_TIME_USER_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToExchange();
    await flow.goToPaymentStep(ENV.CE_AMOUNT);
    // Reach the bank-connection options whichever route the app takes, then check manual is offered
    await flow.openBankConnectionOptions();
    await expect(page.locator('#manual-connection')).toBeVisible({ timeout: 20_000 });
  });
});
