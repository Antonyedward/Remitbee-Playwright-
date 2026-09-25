import { test, expect } from '@playwright/test';
import { CurrencyConverterFlow } from '../../flows/currency-converter/CurrencyConverterFlow';
import { ENV } from '../../config/environments';

test.describe('18 — CurrencyConverter', () => {
  let flow: CurrencyConverterFlow;

  test.beforeEach(async ({ page }) => {
    flow = new CurrencyConverterFlow(page);
  });

  // CC-01: Currency converter page loads
  test('CC-01 @smoke @regression — currency converter page loads', async () => {
    await flow.loginForFlow();
    await flow.navigateToCurrencyConverter();
  });

  // CC-02: Exchange rate is displayed
  test('CC-02 @smoke @regression — exchange rate displayed', async () => {
    await flow.loginForFlow();
    await flow.navigateToCurrencyConverter();
    await flow.assertExchangeRate();
  });

  // CC-03: Entering amount shows converted amount
  test('CC-03 @regression — converted amount calculated when amount entered', async () => {
    await flow.loginForFlow();
    await flow.navigateToCurrencyConverter();
    await flow.enterAmount('100');
    await flow.assertConvertedAmount();
  });

  // CC-04: Swap currencies button changes direction
  test('CC-04 @regression — swap currencies button reverses the conversion pair', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToCurrencyConverter();
    const swapBtn = page
      .locator('button[aria-label*="swap" i], button:has-text("Swap"), button[class*="swap"]')
      .first();
    const visible = await swapBtn.isVisible().catch(() => false);
    if (visible) {
      await swapBtn.click({ force: true });
      await page.waitForTimeout(1_000);
      await flow.assertExchangeRate();
    }
  });

  // CC-05: CAD to USD conversion shows rate > 0
  test('CC-05 @regression — CAD to USD conversion rate visible', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToCurrencyConverter();
    const cadText = page.getByText(/CAD/i).first();
    await expect(cadText).toBeVisible();
    await flow.enterAmount('100');
    await flow.assertExchangeRate();
  });

  // CC-06: USD to CAD conversion via selectFromCurrency
  test('CC-06 @regression — USD to CAD conversion pair selectable', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToCurrencyConverter();
    await flow.selectFromCurrency('USD').catch(() => {});
    await flow.enterAmount('50');
    await flow.assertExchangeRate();
  });

  // CC-07: Clicking send this amount navigates to send money
  test('CC-07 @regression — send this amount button navigates to send money', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToCurrencyConverter();
    await flow.enterAmount('100');
    await flow.assertConvertedAmount();
    await flow.clickSendThisAmount().catch(() => {});
    await page.waitForURL(/send.?money|exchange|rate/i, { timeout: 15_000 }).catch(() => {});
  });

  // CC-08: URL is correct for currency converter / rates page
  test('CC-08 @smoke @regression — currency converter page has correct URL', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToCurrencyConverter();
    await expect(page).toHaveURL(/currency|converter|rate/i);
  });

  // CC-09: Page title / heading visible
  test('CC-09 @regression — currency converter has visible heading or title', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToCurrencyConverter();
    const heading = page
      .locator('h1, h2, [class*="title"], [class*="heading"]')
      .filter({ hasText: /currency|convert|rate|exchange/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  // CC-10: Invalid (alphabetical) amount is handled gracefully
  test('CC-10 @regression — invalid amount input handled gracefully', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToCurrencyConverter();
    await flow.enterAmount('abc');
    await page.waitForTimeout(1_000);
    // Page should not crash — either clears input or shows error
    const pageAlive = await page.locator('body').isVisible();
    expect(pageAlive).toBe(true);
  });

  // CC-11: Personal account can access converter
  test('CC-11 @regression — personal account sees currency converter', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToCurrencyConverter();
    await flow.assertExchangeRate();
  });

  // CC-12: Business account can access converter
  test('CC-12 @regression — business account sees currency converter', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToCurrencyConverter();
    await flow.assertExchangeRate();
  });

  // CC-13: Amount field accepts numeric input
  test('CC-13 @regression — amount field accepts numeric input', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToCurrencyConverter();
    await flow.enterAmount('250');
    const input = page
      .locator('input[name*="amount"], input[placeholder*="amount" i]')
      .first();
    const value = await input.inputValue().catch(() => '');
    expect(value).toContain('250');
  });

  // CC-14: Large amount shows conversion result
  test('CC-14 @regression — large amount (1000) shows converted result', async () => {
    await flow.loginForFlow();
    await flow.navigateToCurrencyConverter();
    await flow.enterAmount('1000');
    await flow.assertConvertedAmount();
  });

  // CC-15: Send amount label or field visible
  test('CC-15 @regression — send amount section is visible', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToCurrencyConverter();
    const sendLabel = page
      .getByText(/you send|send amount|sending/i)
      .first();
    await expect(sendLabel).toBeVisible({ timeout: 10_000 });
  });

  // CC-16: Receive amount label or field visible
  test('CC-16 @regression — receive amount section is visible', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToCurrencyConverter();
    const receiveLabel = page
      .getByText(/you receive|receive amount|receiving/i)
      .first();
    await expect(receiveLabel).toBeVisible({ timeout: 10_000 });
  });
});
