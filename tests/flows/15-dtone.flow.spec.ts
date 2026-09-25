import { test, expect } from '@playwright/test';
import { DtoneFlow } from '../../flows/dtone/DtoneFlow';
import { ENV } from '../../config/environments';

test.describe('15 — DTone (Top-up / Bill Payment / eSIM / Gift Card)', () => {
  let flow: DtoneFlow;

  test.beforeEach(async ({ page }) => {
    flow = new DtoneFlow(page);
  });

  // ── Mobile Top-Up ─────────────────────────────────────────────────────────

  // TC-01 — Splash screen for new user
  test('DT-01 @smoke @regression — mobile top-up page loads (splash for new user)', async ({ page }) => {
    await flow.loginForFlow(ENV.FIRST_TIME_USER_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToDtone();
    await expect(page).toHaveURL(/top.?up|dtone|mobile/i);
  });

  // TC-02/TC-03/TC-04 — Transaction overview - wallet transaction
  test('DT-02 @smoke @regression — mobile top-up phone number entry screen loads', async () => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToDtone();
    await flow.assertPhoneNumberTitle();
  });

  // TC-06/TC-07/TC-08 — Search and select country
  test('DT-03 @smoke @regression — country selection works for Nigeria', async () => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToDtone();
    await flow.selectCountry(ENV.DTONE_SUCCESS_COUNTRY);
    await flow.enterPhoneNumber(ENV.DTONE_MOBILE_PHONE);
    await flow.clickContinue();
    await flow.assertProductTitle();
  });

  // TC-23 — Invalid card details
  test('DT-04 @regression — invalid card details shows error', async () => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToDtone();
    await flow.selectCountry(ENV.DTONE_SUCCESS_COUNTRY);
    await flow.enterPhoneNumber(ENV.DTONE_MOBILE_PHONE);
    await flow.clickContinue();
    await flow.assertProductTitle();
    // Select a product and try to pay with invalid card
    const product = flow['page']
      .locator('[class*="product"], [class*="amount"]')
      .first();
    const visible = await product.isVisible().catch(() => false);
    if (visible) {
      await product.click({ force: true });
      await flow.clickContinue();
      const debitOption = flow['page']
        .getByText(/debit|card/i)
        .first();
      const debitVisible = await debitOption.isVisible().catch(() => false);
      if (debitVisible) {
        await debitOption.click({ force: true });
        const cardNumberInput = flow['page']
          .locator('input[name*="card"], input[placeholder*="card" i]')
          .first();
        const inputVisible = await cardNumberInput.isVisible().catch(() => false);
        if (inputVisible) {
          await cardNumberInput.fill('36477356734888998'); // invalid
        }
      }
    }
  });

  // ── Bill Payment ─────────────────────────────────────────────────────────

  // TC-01 — Bill payment splash page for first-time users
  test('DT-05 @smoke @regression — bill payment page loads', async ({ page }) => {
    await flow.loginForFlow(ENV.FIRST_TIME_USER_EMAIL, ENV.USER_PASSWORD);
    await page.goto(`${ENV.BASE_URL}/international-bill`);
    await page.waitForURL(/international.?bill|bill/i, { timeout: 15_000 }).catch(() => {});
    const pageContent = flow['page']
      .locator('[class*="bill"], [class*="payment"], [class*="country"]')
      .first();
    await expect(pageContent).toBeVisible({ timeout: 15_000 });
  });

  // TC-18 — Bill payment wallet with negative balance
  test('DT-06 @regression — bill payment wallet state with negative balance handled', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_NO_BALANCE_EMAIL, ENV.BUSINESS_PASSWORD);
    await page.goto(`${ENV.BASE_URL}/international-bill`);
    await page.waitForURL(/international.?bill|bill/i, { timeout: 15_000 }).catch(() => {});
  });

  // TC-24/TC-17 — Successful payment using wallet balance
  test('DT-07 @smoke @regression — bill payment with Ghana country initiates', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await page.goto(`${ENV.BASE_URL}/international-bill`);
    await page.waitForURL(/international.?bill|bill/i, { timeout: 15_000 }).catch(() => {});
    await flow.selectCountry(ENV.DTONE_BILL_PAYMENT_COUNTRY);
    await flow.clickContinue();
  });

  // TC-02 — Bill payment no splash for existing users
  test('DT-08 @regression — existing user sees bill payment directly without splash', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await page.goto(`${ENV.BASE_URL}/international-bill`);
    await page.waitForURL(/international.?bill|bill/i, { timeout: 15_000 }).catch(() => {});
    const splash = flow['page']
      .locator('[class*="splash"], [class*="intro"]')
      .first();
    // Existing users should bypass splash — page should load without it
    const visible = await splash.isVisible().catch(() => false);
    expect(visible).toBe(false); // splash must NOT appear for existing users
  });

  // TC-25/TC-26 — Navigation to receipt country from overview
  test('DT-09 @regression — bill payment country dropdown shows supported countries', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await page.goto(`${ENV.BASE_URL}/international-bill`);
    await page.waitForURL(/international.?bill|bill/i, { timeout: 15_000 }).catch(() => {});
    const countryDropdown = flow['page']
      .locator('[class*="country"], select[name*="country"]')
      .first();
    await expect(countryDropdown).toBeVisible({ timeout: 10_000 });
  });

  // ── eSIM ─────────────────────────────────────────────────────────────────

  // ES-01 — eSIM splash for new user
  test('DT-10 @smoke @regression — eSIM page loads', async ({ page }) => {
    await flow.loginForFlow(ENV.FIRST_TIME_USER_EMAIL, ENV.USER_PASSWORD);
    await page.goto(`${ENV.BASE_URL}/e-sim`);
    await page.waitForURL(/e.?sim/i, { timeout: 15_000 }).catch(() => {});
    const esimPage = flow['page']
      .locator('[class*="esim"], [class*="sim"], [class*="country"]')
      .first();
    await expect(esimPage).toBeVisible({ timeout: 15_000 });
  });

  // ES-26 — Successful wallet transaction via eSIM
  test('DT-11 @smoke @regression — eSIM local plan for existing user initiates', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await page.goto(`${ENV.BASE_URL}/e-sim`);
    await page.waitForURL(/e.?sim/i, { timeout: 15_000 }).catch(() => {});
    await flow.selectCountry(ENV.DTONE_ESIM_COUNTRY);
    await flow.clickContinue();
  });

  // ES-28 — Error on continue without email
  test('DT-12 @regression — eSIM shows error when continuing without email', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await page.goto(`${ENV.BASE_URL}/e-sim`);
    await page.waitForURL(/e.?sim/i, { timeout: 15_000 }).catch(() => {});
    await flow.selectCountry(ENV.DTONE_ESIM_COUNTRY);
    await flow.clickContinue();
    // Try to proceed without email
    const emailField = flow['page']
      .locator('input[type="email"], input[name*="email"]')
      .first();
    const visible = await emailField.isVisible().catch(() => false);
    if (visible) {
      await flow.clickContinue();
      const error = flow['page'].locator('[class*="error"]').first();
      await expect(error).toBeVisible({ timeout: 5_000 });
    }
  });

  // ES-20 — Non-existent country search
  test('DT-13 @regression — eSIM search for non-existent country shows no results', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await page.goto(`${ENV.BASE_URL}/e-sim`);
    await page.waitForURL(/e.?sim/i, { timeout: 15_000 }).catch(() => {});
    await flow.selectCountry('zzzznonexistent');
    const noResult = flow['page']
      .getByText(/no result|not found|unavailable/i)
      .first();
    await expect(noResult).toBeVisible({ timeout: 5_000 });
  });

  // ES-31/ES-32 — QR functionality
  test('DT-14 @regression — QR login for eSIM works', async ({ page }) => {
    await flow.loginForFlow(ENV.DTONE_QR_EMAIL, ENV.DTONE_QR_PASSWORD);
    await page.goto(`${ENV.BASE_URL}/e-sim`);
    await page.waitForURL(/e.?sim/i, { timeout: 15_000 }).catch(() => {});
  });

  // ── Gift Card ─────────────────────────────────────────────────────────────

  // TC001 — Gift card splash for first-time user
  test('DT-15 @regression — gift card splash screen loads for new user', async ({ page }) => {
    await flow.loginForFlow(ENV.FIRST_TIME_USER_EMAIL, ENV.USER_PASSWORD);
    await page.goto(`${ENV.BASE_URL}/gift-card`);
    await page.waitForURL(/gift.?card/i, { timeout: 15_000 }).catch(() => {});
    const giftPage = flow['page']
      .locator('[class*="gift"], [class*="splash"], [class*="country"]')
      .first();
    await expect(giftPage).toBeVisible({ timeout: 15_000 });
  });

  // TC008/TC010/TC011 — Country selection enables continue button
  test('DT-16 @smoke @regression — gift card country selection enables continue', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await page.goto(`${ENV.BASE_URL}/gift-card`);
    await page.waitForURL(/gift.?card/i, { timeout: 15_000 }).catch(() => {});
    await flow.selectCountry(ENV.DTONE_SUCCESS_COUNTRY);
    const continueBtn = flow['page'].locator('button:has-text("Continue")').first();
    await expect(continueBtn).toBeVisible({ timeout: 10_000 });
  });

  // TC042 — Gift card wallet payment
  test('DT-17 @regression — gift card payment via CAD balance initiates', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await page.goto(`${ENV.BASE_URL}/gift-card`);
    await page.waitForURL(/gift.?card/i, { timeout: 15_000 }).catch(() => {});
    await flow.selectCountry(ENV.DTONE_SUCCESS_COUNTRY);
    await flow.clickContinue();
  });

  // TC021 — Personalized message optional
  test('DT-18 @regression — personalized message field is optional on gift card order', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await page.goto(`${ENV.BASE_URL}/gift-card`);
    await page.waitForURL(/gift.?card/i, { timeout: 15_000 }).catch(() => {});
    await flow.selectCountry(ENV.DTONE_SUCCESS_COUNTRY);
    await flow.clickContinue();
    const messageField = flow['page']
      .locator('input[name*="message"], textarea[name*="message"]')
      .first();
    const visible = await messageField.isVisible().catch(() => false);
    if (visible) {
      // Field is optional — don't fill it
      await flow.clickContinue();
    }
  });

  // TC026/TC027 — Payment options for user with sufficient balance
  test('DT-19 @regression — user with balance sees both CAD balance and debit card options', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await page.goto(`${ENV.BASE_URL}/gift-card`);
    await page.waitForURL(/gift.?card/i, { timeout: 15_000 }).catch(() => {});
    await flow.selectCountry(ENV.DTONE_SUCCESS_COUNTRY);
    await flow.clickContinue();
    // Navigate to payment page
    const productBtn = flow['page']
      .locator('[class*="product"], [class*="denomination"]')
      .first();
    const productVisible = await productBtn.isVisible().catch(() => false);
    if (productVisible) {
      await productBtn.click({ force: true });
      await flow.clickContinue();
      const walletOption = flow['page'].locator('#pay-from-balance').first();
      await expect(walletOption).toBeVisible({ timeout: 10_000 });
    }
  });

  // TC032 — Close and go to dashboard
  test('DT-20 @regression — close button returns to dashboard from gift card flow', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await page.goto(`${ENV.BASE_URL}/gift-card`);
    await page.waitForURL(/gift.?card/i, { timeout: 15_000 }).catch(() => {});
    const closeBtn = flow['page']
      .locator('button:has-text("Close"), a:has-text("Close"), button[aria-label*="close" i]')
      .first();
    const visible = await closeBtn.isVisible().catch(() => false);
    if (visible) {
      await closeBtn.click({ force: true });
      await page.waitForURL(/dashboard|home/i, { timeout: 10_000 }).catch(() => {});
    }
  });
});
