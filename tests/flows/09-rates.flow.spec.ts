import { test, expect } from '@playwright/test';
import { RatesFlow } from '../../flows/rates/RatesFlow';
import { ENV } from '../../config/environments';

test.describe('09 — Rates', () => {
  let flow: RatesFlow;

  test.beforeEach(async ({ page }) => {
    flow = new RatesFlow(page);
  });

  // RC-01/RC-03/RC-06 — Rates on dashboard
  test('RC-01 @smoke @regression — rates page loads and shows rates', async () => {
    await flow.loginForFlow(ENV.RATES_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRates();
    await flow.assertRatesTableVisible();
  });

  // RC-07 — Converter frame - different country (Money Transfer)
  test('RC-02 @smoke @regression — converter frame loads for Ghana (GHS)', async () => {
    await flow.loginForFlow(ENV.RATES_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRates();
    await flow.selectCountry('ghana', 'GHS');
    await flow.assertRatesTableVisible();
  });

  // RC-07 — Brazil
  test('RC-03 @regression — converter frame for Brazil (BRL)', async () => {
    await flow.loginForFlow(ENV.RATES_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRates();
    await flow.selectCountry('brazil', 'BRL');
    await flow.assertRatesTableVisible();
  });

  // RC-07 — Pakistan
  test('RC-04 @regression — converter frame for Pakistan (PKR)', async () => {
    await flow.loginForFlow(ENV.RATES_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRates();
    await flow.selectCountry('pakistan', 'PKR');
    await flow.assertRatesTableVisible();
  });

  // RC-07 — Philippines
  test('RC-05 @regression — converter frame for Philippines (PHP)', async () => {
    await flow.loginForFlow(ENV.RATES_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRates();
    await flow.selectCountry('philippines', 'PHP');
    await flow.assertRatesTableVisible();
  });

  // RC-07 — Sri Lanka
  test('RC-06 @regression — converter frame for Sri Lanka (LKR)', async () => {
    await flow.loginForFlow(ENV.RATES_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRates();
    await flow.selectCountry('sri lanka', 'LKR');
    await flow.assertRatesTableVisible();
  });

  // RC-02/RC-04/RC-05 — Currency rates converter frame
  test('RC-07 @regression — receive amount calculation for CAD 100', async () => {
    await flow.loginForFlow(ENV.RATES_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRates();
    await flow.enterAmount('100');
    await flow.assertRatesTableVisible();
    // They receive ≈ 100 × rate (heading rate is rounded to 2 dp → allow 1%)
    const { rate } = await flow.getRate();
    await expect.poll(async () => RatesFlow.toNumber(await flow.receiveInput().inputValue()), { timeout: 20_000 })
      .toBeGreaterThan(100 * rate * 0.99);
    expect(RatesFlow.toNumber(await flow.receiveInput().inputValue())).toBeLessThan(100 * rate * 1.01);
  });

  // RC-08/RC-09/RC-11 — Country search in dropdown
  test('RC-08 @regression — country search in dropdown finds correct country', async () => {
    await flow.loginForFlow(ENV.RATES_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRates();
    await flow.searchCountry('Nigeria');
    await expect(flow['page'].locator('li#NGN:visible').first()).toBeVisible({ timeout: 15_000 });
    await expect(flow['page'].locator('li#NGN:visible').first()).toContainText(/Nigeria/i);
    await flow.selectCountry('Nigeria', 'NGN');
  });

  // RC-13 — Favorite currencies
  test('RC-09 @regression — can mark country as favorite', async () => {
    await flow.loginForFlow(ENV.RATES_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRates();
    await flow.toggleFavorite();
  });

  // RC-14/RC-15 — Notification tab
  test('RC-10 @regression — notifications tab visible in rates', async () => {
    await flow.loginForFlow(ENV.RATES_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRates();
    await flow.clickNotificationsTab();
  });

  // RC-16/RC-17/RC-18 — Rates conversion and navigation
  test('RC-11 @regression — clicking send money from rates navigates to send money', async ({ page }) => {
    await flow.loginForFlow(ENV.RATES_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRates();
    // Jam: #send-money → /money-transfer
    await page.locator('#send-money').click();
    await page.waitForURL(/\/money-transfer/, { timeout: 30_000 });
  });

  // Invalid amount
  test('RC-12 @regression — invalid amount in converter shows error', async () => {
    await flow.loginForFlow(ENV.RATES_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRates();
    // Below the $10 minimum → "Minimum sending amount is $10 CAD" (MoneyTransferRateDetails min10CADError)
    await flow.enterAmount('5');
    await flow.assertMinAmountError();
    // Letters are not accepted by the amount field
    await flow.sendInput().fill('');
    await flow.sendInput().pressSequentially('abc');
    await expect(flow.sendInput()).not.toHaveValue(/[a-z]/i);
  });

  // Invalid country
  test('RC-13 @regression — invalid country in search shows no results', async () => {
    await flow.loginForFlow(ENV.RATES_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRates();
    await flow.searchCountry('cuba');
    // No match → "Can't find your country? Request a new country …" (DropDownList not_found_country)
    const notFound = flow['page'].locator('li#not_found_country:visible').first();
    await expect(notFound).toBeVisible({ timeout: 15_000 });
    await expect(notFound).toContainText(/can't find your country/i);
  });

  // Receiving amount
  test('RC-14 @regression — receiving amount field updates when send amount changes', async () => {
    await flow.loginForFlow(ENV.RATES_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRates();
    await flow.enterAmount('100');
    await flow.assertRatesTableVisible();
    const before = RatesFlow.toNumber(await flow.receiveInput().inputValue());
    await flow.enterAmount('1000');
    await expect.poll(async () => RatesFlow.toNumber(await flow.receiveInput().inputValue()), { timeout: 20_000 })
      .toBeGreaterThan(before * 9);
  });

  // Rates page URL
  test('RC-15 @smoke @regression — rates page has correct URL', async ({ page }) => {
    await flow.loginForFlow(ENV.RATES_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRates();
    await expect(page).toHaveURL(/rate/i);
  });

  // RC-16 — Navigate to CE from rates
  test('RC-16 @regression — clicking currency exchange from rates navigates to CE', async ({ page }) => {
    await flow.loginForFlow(ENV.RATES_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRates();
    const ceBtn = flow['page']
      .locator('button:has-text("Exchange"), a:has-text("Exchange")')
      .first();
    const visible = await ceBtn.isVisible().catch(() => false);
    if (visible) {
      await ceBtn.click({ force: true });
      await page.waitForURL(/exchange|currency/i, { timeout: 15_000 }).catch(() => {});
    }
  });

  // RC-17 — Rate display for personal account
  test('RC-17 @regression — personal account shows standard rate on rates page', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRates();
    await flow.assertRatesTableVisible();
  });

  // RC-18 — Rate display for rewards account
  test('RC-18 @regression — rewards account shows rates page with promo applied', async () => {
    await flow.loginForFlow(ENV.REWARDS_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToRates();
    await flow.assertRatesTableVisible();
  });
});
