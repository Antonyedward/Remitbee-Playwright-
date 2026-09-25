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
    await flow.enterAmount(ENV.CE_AMOUNT);
    await flow.clickExchange();
    // Payment method step loads
    const payMethod = flow['page']
      .locator('[class*="payment"], [class*="method"]')
      .first();
    await expect(payMethod).toBeVisible({ timeout: 15_000 });
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
    await flow.enterAmount(ENV.CE_AMOUNT);
    await flow.clickExchange();
    const walletOption = flow['page']
      .locator('#pay-from-balance, [class*="wallet"], text=/pay from balance/i')
      .first();
    await expect(walletOption).toBeVisible({ timeout: 15_000 });
  });

  // TC031 — First time user has fee-free EFT
  test('CE-12 @regression — first time user EFT has fee-free label', async ({ page }) => {
    await flow.loginForFlow(ENV.FIRST_TIME_USER_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToExchange();
    await flow.enterAmount(ENV.CE_AMOUNT);
    await flow.clickExchange();
    const feeFree = flow['page'].getByText(/fee.?free|0\.00|no fee/i).first();
    await expect(feeFree).toBeVisible({ timeout: 15_000 });
  });

  // TC034 — Business exceeding daily limit
  test('CE-13 @regression — business account exceeding daily limit shows restriction', async ({ page }) => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToExchange();
    await flow.enterAmount('250001');
    await flow.clickExchange();
    const limitMsg = flow['page']
      .locator('[class*="error"], [class*="limit"]')
      .filter({ hasText: /limit|exceed|maximum/i })
      .first();
    await expect(limitMsg).toBeVisible({ timeout: 10_000 });
  });

  // TC030/TC034 — Existing user CE using CAD balance
  test('CE-14 @regression — existing user can complete CE using CAD balance', async ({ page }) => {
    await flow.loginForFlow(ENV.CE_SUFFICIENT_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToExchange();
    await flow.enterAmount(ENV.CE_AMOUNT);
    await flow.clickExchange();
    await flow.clickPayFromBalance();
    await flow.clickExchange();
    await flow.clickDepositToBalance();
    await flow.clickExchange();
    // Review page should load
    const reviewSection = flow['page']
      .locator('[class*="review"], [class*="summary"]')
      .first();
    await expect(reviewSection).toBeVisible({ timeout: 15_000 });
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
    // Both currency options should be accessible
    const cadOption = flow['page'].getByText(/CAD/i).first();
    const usdOption = flow['page'].getByText(/USD/i).first();
    await expect(cadOption).toBeVisible();
    await expect(usdOption).toBeVisible();
  });

  // CE less amount
  test('CE-17 @regression — less than minimum amount shows error', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToExchange();
    await flow.enterAmount(ENV.CE_LESS_AMOUNT);
    await flow.clickExchange();
    const error = flow['page']
      .locator('[class*="error"]')
      .filter({ hasText: /minimum|least|invalid|amount/i })
      .first();
    await expect(error).toBeVisible({ timeout: 10_000 });
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
    await flow.enterAmount(ENV.CE_AMOUNT);
    await flow.clickExchange();
    await flow.clickPayFromBalance();
    await flow.clickExchange();
    await flow.clickDepositToBank();
    const reviewSection = flow['page']
      .locator('[class*="review"], [class*="summary"], [class*="bank"]')
      .first();
    await expect(reviewSection).toBeVisible({ timeout: 15_000 });
  });

  // TC044 — Manual EFT connection + micro deposit
  test('CE-20 @regression — new user can connect bank manually for CE', async ({ page }) => {
    await flow.loginForFlow(ENV.FIRST_TIME_USER_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToExchange();
    await flow.enterAmount(ENV.CE_AMOUNT);
    await flow.clickExchange();
    const connectBank = flow['page']
      .locator('button:has-text("Connect"), button:has-text("Link bank"), button:has-text("Add bank")')
      .first();
    await expect(connectBank).toBeVisible({ timeout: 15_000 });
  });
});
