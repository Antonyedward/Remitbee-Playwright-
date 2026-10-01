import { test, expect } from '@playwright/test';
import { DtoneFlow } from '../../flows/dtone/DtoneFlow';
import { ENV } from '../../config/environments';

/**
 * 15 — DT One services. Follows Jam 6c33f327 up to (not including) "Confirm and pay",
 * so no real top-ups / gift cards / eSIMs are bought on staging.
 */
test.describe('15 — DTone (Top-up / Bill Payment / eSIM / Gift Card)', () => {
  test.describe.configure({ timeout: 180_000 });
  let flow: DtoneFlow;

  test.beforeEach(async ({ page }) => {
    flow = new DtoneFlow(page);
  });

  // ── Mobile Top-Up ─────────────────────────────────────────────────────────

  test('DT-01 @smoke @regression — mobile top-up page loads (splash for new user)', async ({ page }) => {
    await flow.loginForFlow(ENV.FIRST_TIME_USER_EMAIL, ENV.USER_PASSWORD);
    await flow.open('mobile-top-up');
    await expect(page).toHaveURL(/mobile-top-up/);
    await expect(flow.splashButton().or(flow.countryDropdown()).first()).toBeVisible();
  });

  test('DT-02 @smoke @regression — mobile top-up phone number entry screen loads', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.openAndStart('mobile-top-up');
    await expect(page.getByRole('heading', { name: /where are you sending a mobile top-up/i })).toBeVisible({ timeout: 20_000 });
    await flow.selectCountry(ENV.DTONE_SUCCESS_COUNTRY);
    await flow.clickCountryContinue();
    await page.waitForURL(/recipient-details\/phone-number/, { timeout: 30_000 });
    await flow.assertPhoneNumberTitle();
  });

  test('DT-03 @smoke @regression — country selection works for Nigeria (phone → products)', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.topUpToProducts();
    await expect(page.locator('#edit-carrier:visible').first()).toBeVisible();
    await expect(page.locator('#continue:visible').first()).toBeEnabled({ timeout: 20_000 }); // first plan auto-selected
  });

  test('DT-04 @regression — invalid card details shows error', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.topUpToProducts();
    await flow.topUpToPaymentType();
    await flow.submitInvalidCard('123456789012'); // 12 digits — invalid
    await expect(page.getByText(/card number must have 16 digits|card is not supported/i).first()).toBeVisible({ timeout: 10_000 });
  });

  // ── Bill Payment ─────────────────────────────────────────────────────────

  test('DT-05 @smoke @regression — bill payment page loads (splash for new user)', async ({ page }) => {
    await flow.loginForFlow(ENV.FIRST_TIME_USER_EMAIL, ENV.USER_PASSWORD);
    await flow.open('international-bill');
    // Splash "Pay international bills" for brand-new users, otherwise straight to the country step
    await expect(page.getByRole('heading', { name: /pay international bills/i }).or(flow.countryDropdown()).first()).toBeVisible();
  });

  test('DT-06 @regression — bill payment loads for a user with no wallet balance', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_NO_BALANCE_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.openAndStart('international-bill');
    await expect(page).toHaveURL(/international-bill/);
    await expect(flow.countryDropdown()).toBeVisible({ timeout: 30_000 });
  });

  // Bill payment parked for now (on request) — switch back to test(...) to re-enable
  test.fixme('DT-07 @smoke @regression — bill payment for India (VOIP) reaches provider step', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.billToUtility();          // India (Jam 21b71844)
    await flow.billSelectUtility();      // VOIP
    await expect(page).toHaveURL(/international-bill\/providers/);
  });

  test('DT-08 @regression — existing user reaches the bill payment country step in one click', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.openAndStart('international-bill');
    await expect(flow.countryDropdown()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#country-selection-continue:visible')).toBeVisible();
  });

  // Bill payment parked for now (on request) — switch back to test(...) to re-enable
  test.fixme('DT-09 @regression — bill payment country dropdown shows supported countries', async () => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.openAndStart('international-bill');
    await flow.openCountryDropdown();
    await expect(flow.dropdownOptions().first()).toBeVisible({ timeout: 15_000 });
    expect(await flow.dropdownOptions().count()).toBeGreaterThan(1);
    await flow.searchCountry(ENV.DTONE_BILL_PAYMENT_COUNTRY);
    await expect(flow.dropdownOptions().filter({ hasText: new RegExp(ENV.DTONE_BILL_PAYMENT_COUNTRY, 'i') }).first()).toBeVisible();
  });

  // ── eSIM ─────────────────────────────────────────────────────────────────

  test('DT-10 @smoke @regression — eSIM page loads (splash for new user)', async ({ page }) => {
    await flow.loginForFlow(ENV.FIRST_TIME_USER_EMAIL, ENV.USER_PASSWORD);
    await flow.open('e-sim');
    // Splash for brand-new users, otherwise straight to "Choose your destination"
    await expect(page.getByRole('heading', { name: /travel e-?sim|choose your destination/i }).first()).toBeVisible();
  });

  test('DT-11 @smoke @regression — eSIM local plan for existing user initiates', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.esimToChooseDestination('local');
    await flow.esimPickCountry(ENV.DTONE_ESIM_COUNTRY);
    await expect(page).toHaveURL(/select-product/);
  });

  test('DT-12 @regression — eSIM shows error when continuing without email', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.esimToRecipientInfo(ENV.DTONE_ESIM_COUNTRY);
    await page.locator('input#email-input:visible').first().fill('');
    await page.locator('#continue:visible').first().click();
    await expect(page.getByText(/please enter an email address/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/recipient-info/);
  });

  test('DT-13 @regression — eSIM search for non-existent country shows no results', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.esimToChooseDestination('local');
    await flow.esimSearchDestination('zzzznonexistent');
    await expect(page.getByText(/no search results found/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('DT-14 @regression — QR eSIM account can open the eSIM flow', async ({ page }) => {
    try {
      await flow.loginForFlow(ENV.DTONE_QR_EMAIL, ENV.DTONE_QR_PASSWORD);
    } catch (e) {
      test.skip(/authentication failed/i.test(String(e)),
        `DTONE_QR_EMAIL (${ENV.DTONE_QR_EMAIL}) cannot log in on staging — update the account/password`);
      throw e;
    }
    await flow.openAndStart('e-sim');
    await expect(page).toHaveURL(/e-sim/);
  });

  // ── Gift Card ─────────────────────────────────────────────────────────────

  test('DT-15 @regression — gift card splash screen loads for new user', async ({ page }) => {
    await flow.loginForFlow(ENV.FIRST_TIME_USER_EMAIL, ENV.USER_PASSWORD);
    await flow.open('gift-card');
    await expect(page).toHaveURL(/gift-card/);
    await expect(flow.splashButton().or(flow.countryDropdown()).first()).toBeVisible();
  });

  test('DT-16 @smoke @regression — gift card country selection enables continue', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.giftToOrderDetails();
    await expect(page.locator('#select-provider').first()).toBeVisible();
    await expect(page.locator('#select-operator-continue:visible').first()).toBeVisible();
  });

  test('DT-17 @regression — gift card payment via CAD balance initiates', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.giftToPaymentType('Automation test');
    await flow.choosePayType('wallet');
    await page.waitForURL(/gift-card\/overview\/summary/, { timeout: 30_000 });
    await expect(page.locator('#submit-transaction:visible').first()).toBeVisible({ timeout: 20_000 }); // not clicked
  });

  test('DT-18 @regression — personalized message field is optional on gift card order', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.giftToPaymentType(); // message left empty
    await expect(page).toHaveURL(/gift-card\/payment/);
  });

  test('DT-19 @regression — user with balance sees both CAD balance and debit card options', async () => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.giftToPaymentType();
    await expect(flow.walletOption()).toBeVisible();
    await expect(flow.debitOption()).toBeVisible();
  });

  test('DT-20 @regression — close button returns to dashboard from gift card flow', async ({ page }) => {
    await flow.loginForFlow(ENV.CAD_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.openAndStart('gift-card');
    await flow.closeWizard();
    await expect(page).toHaveURL(/dashboard/);
  });
});
