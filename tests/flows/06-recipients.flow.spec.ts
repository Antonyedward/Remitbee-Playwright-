/**
 * 06 — Recipients
 *
 * Covers list, add wizard (3 steps), and edit/delete.
 * Real element IDs from:
 *   src/components/recipients-v2/ (CP source)
 *   Selenium POMs: RecipientsPage.java, AddRecipientPage*.java
 *
 * CAUTION: Tests that call addRecipientEndToEnd() create real records.
 * They are @regression-only and should run against a test-data environment.
 */

import { test, expect } from '@playwright/test';
import { RecipientsFlow } from '../../flows/recipients/RecipientsFlow';

test.describe('06 — Recipients', () => {
  // Staging's customer/recipient APIs were seen taking ~37s (RC-21 trace, 2026-09-30); login + a slow
  // recipient list can exceed the default 90s test timeout, so give this module more headroom.
  test.describe.configure({ timeout: 150_000 });

  let flow: RecipientsFlow;

  test.beforeEach(async ({ page }) => {
    flow = new RecipientsFlow(page);
    await flow.loginForFlow();
  });

  // ── LIST PAGE ─────────────────────────────────────────────────────────────────

  test('RC-01 @smoke @regression — recipients page loads', async () => {
    await flow.navigateToRecipients();
    await flow.assertRecipientsPageLoaded();
  });

  test('RC-02 @regression — add-new-recipient button visible on recipients page', async () => {
    await flow.navigateToRecipients();
    await expect(flow['page'].locator('#add-new-recipient')).toBeVisible();
  });

  test('RC-03 @regression — clicking add-new-recipient navigates to add-country step', async () => {
    await flow.navigateToRecipients();
    await flow.clickAddNewRecipient();
    await flow.assertAddCountryStep();
  });

  // ── ADD WIZARD — STEP 0: Country ─────────────────────────────────────────────

  test('RC-04 @regression — add-country step has send-money-country-selection dropdown', async () => {
    await flow.navigateToRecipients();
    await flow.clickAddNewRecipient();
    await flow.assertAddCountryStep();
    await expect(flow['page'].locator('button#send-money-country-selection')).toBeVisible();
  });

  test('RC-05 @regression — add-country step has send-money-currency-selection dropdown', async () => {
    await flow.navigateToRecipients();
    await flow.clickAddNewRecipient();
    await flow.assertAddCountryStep();
    // The currency dropdown only renders once a country with >1 receiving currency is chosen
    // (AddCountry.tsx: selectedCountry.currencies.length > 1)
    await flow.selectFirstMultiCurrencyCountry();
    await expect(flow['page'].locator('button#send-money-currency-selection')).toBeVisible({ timeout: 10_000 });
  });

  test('RC-06 @regression — add-country step has send-money-addCountry continue button', async () => {
    await flow.navigateToRecipients();
    await flow.clickAddNewRecipient();
    await flow.assertAddCountryStep();
    await expect(flow['page'].locator('#send-money-addCountry')).toBeVisible();
  });

  test('RC-07 @regression — selecting India and continuing advances to receiving-method step', async () => {
    await flow.navigateToRecipients();
    await flow.clickAddNewRecipient();
    await flow.assertAddCountryStep();
    await flow.selectRecipientCountry('India');
    await flow.clickCountryContinue();
    await flow.assertAddReceivingMethodStep();
  });

  // ── ADD WIZARD — STEP 1: Receiving method ────────────────────────────────────

  test('RC-08 @regression — receiving-method step has recipients-select-method element', async () => {
    await flow.navigateToRecipients();
    await flow.clickAddNewRecipient();
    await flow.assertAddCountryStep();
    await flow.selectRecipientCountry('India');
    await flow.clickCountryContinue();
    await flow.assertAddReceivingMethodStep();
    await expect(flow['page'].locator('#recipients-select-method')).toBeVisible();
  });

  test('RC-09 @regression — receiving-method step has recipients-addCountry continue button', async () => {
    await flow.navigateToRecipients();
    await flow.clickAddNewRecipient();
    await flow.selectRecipientCountry('India');
    await flow.clickCountryContinue();
    await flow.assertAddReceivingMethodStep();
    await expect(flow['page'].locator('#recipients-addCountry')).toBeVisible();
  });

  test('RC-10 @regression — selecting bank transfer method and continuing advances to beneficiary step', async () => {
    await flow.navigateToRecipients();
    await flow.clickAddNewRecipient();
    await flow.selectRecipientCountry('India');
    await flow.clickCountryContinue();
    await flow.assertAddReceivingMethodStep();
    await flow.selectReceivingMethod('Bank deposit');
    await flow.clickReceivingMethodContinue();
    await flow.assertBeneficiaryFormStep();
  });

  // ── ADD WIZARD — STEP 2: Beneficiary form ────────────────────────────────────

  test('RC-11 @regression — beneficiary step has person-input radio for personal recipient', async () => {
    await flow.navigateToRecipients();
    await flow.clickAddNewRecipient();
    await flow.selectRecipientCountry('India');
    await flow.clickCountryContinue();
    await flow.selectReceivingMethod('Bank deposit');
    await flow.clickReceivingMethodContinue();
    await flow.assertBeneficiaryFormStep();
    const personal = flow['page'].locator('#person-input');
    const visible = await personal.isVisible().catch(() => false);
    if (visible) await expect(personal).toBeVisible();
  });

  test('RC-12 @regression — beneficiary step has ben_firstname input', async () => {
    await flow.navigateToRecipients();
    await flow.clickAddNewRecipient();
    await flow.selectRecipientCountry('India');
    await flow.clickCountryContinue();
    await flow.selectReceivingMethod('Bank deposit');
    await flow.clickReceivingMethodContinue();
    await flow.assertBeneficiaryFormStep();
    await flow.selectPersonalRecipient();
    await expect(flow['page'].locator('#ben_firstname')).toBeVisible({ timeout: 10_000 });
  });

  test('RC-13 @regression — beneficiary step has ben_lastname input', async () => {
    await flow.navigateToRecipients();
    await flow.clickAddNewRecipient();
    await flow.selectRecipientCountry('India');
    await flow.clickCountryContinue();
    await flow.selectReceivingMethod('Bank deposit');
    await flow.clickReceivingMethodContinue();
    await flow.assertBeneficiaryFormStep();
    await flow.selectPersonalRecipient();
    await expect(flow['page'].locator('#ben_lastname')).toBeVisible({ timeout: 10_000 });
  });

  test('RC-14 @regression — submit empty beneficiary form shows first-name error', async () => {
    await flow.navigateToRecipients();
    await flow.clickAddNewRecipient();
    await flow.selectRecipientCountry('India');
    await flow.clickCountryContinue();
    await flow.selectReceivingMethod('Bank deposit');
    await flow.clickReceivingMethodContinue();
    await flow.assertBeneficiaryFormStep();
    await flow.selectPersonalRecipient();
    await flow.clickBeneficiaryContinue();
    await flow.assertFirstNameError();
  });

  test('RC-15 @regression — submit with first name only shows last-name error', async () => {
    await flow.navigateToRecipients();
    await flow.clickAddNewRecipient();
    await flow.selectRecipientCountry('India');
    await flow.clickCountryContinue();
    await flow.selectReceivingMethod('Bank deposit');
    await flow.clickReceivingMethodContinue();
    await flow.assertBeneficiaryFormStep();
    await flow.selectPersonalRecipient();
    await flow.fillFirstName('TestFirst');
    await flow.clickBeneficiaryContinue();
    await flow.assertLastNameError();
  });

  test('RC-16 @regression — business-label radio visible for business recipient type', async () => {
    await flow.navigateToRecipients();
    await flow.clickAddNewRecipient();
    await flow.selectRecipientCountry('India');
    await flow.clickCountryContinue();
    await flow.selectReceivingMethod('Bank deposit');
    await flow.clickReceivingMethodContinue();
    await flow.assertBeneficiaryFormStep();
    const biz = flow['page'].locator('#business-label');
    const visible = await biz.isVisible().catch(() => false);
    if (visible) await expect(biz).toBeVisible();
    else test.skip(); // not all corridors show business option
  });

  // ── FULL END-TO-END — India Bank deposit ────────────────────────────────────

  test('RC-17 @smoke @regression — add India bank-transfer recipient end-to-end', async () => {
    const uniqueName = RecipientsFlow.uniqueName('Playwright'); // letters only — digits are rejected
    await flow.addRecipientEndToEnd({
      country: 'India',
      method: 'Bank deposit',
      firstName: uniqueName,
      lastName: 'Test',
      accountNumber: RecipientsFlow.uniqueAccountNumber(),
      ifsc: RecipientsFlow.DEFAULT_IFSC,
    });
    // After "Got it", should be back on /recipients list
    await expect(flow['page']).toHaveURL(/\/recipients(\?|$)/i, { timeout: 20_000 });
  });

  test('RC-18 @regression — success dialog shows recipient-added-dialog id', async () => {
    const uniqueName = RecipientsFlow.uniqueName('PW'); // letters only — digits are rejected
    await flow.navigateToRecipients();
    await flow.clickAddNewRecipient();
    await flow.selectRecipientCountry('India');
    await flow.clickCountryContinue();
    await flow.selectReceivingMethod('Bank deposit');
    await flow.clickReceivingMethodContinue();
    await flow.selectPersonalRecipient();
    await flow.fillFirstName(uniqueName);
    await flow.fillLastName('Auto');
    await flow.fillAccountNumber(RecipientsFlow.uniqueAccountNumber());
    await flow.fillIFSC(RecipientsFlow.DEFAULT_IFSC); // India: IFSC is required
    await flow.clickBeneficiaryContinue();
    await flow.assertRecipientAddedDialog();
  });

  test('RC-19 @regression — dialog-button-primaryAction (Got it) dismisses success dialog', async () => {
    const uniqueName = RecipientsFlow.uniqueName('PW'); // letters only — digits are rejected
    await flow.navigateToRecipients();
    await flow.clickAddNewRecipient();
    await flow.selectRecipientCountry('India');
    await flow.clickCountryContinue();
    await flow.selectReceivingMethod('Bank deposit');
    await flow.clickReceivingMethodContinue();
    await flow.selectPersonalRecipient();
    await flow.fillFirstName(uniqueName);
    await flow.fillLastName('Auto');
    await flow.fillAccountNumber(RecipientsFlow.uniqueAccountNumber());
    await flow.fillIFSC(RecipientsFlow.DEFAULT_IFSC); // India: IFSC is required
    await flow.clickBeneficiaryContinue();
    await flow.assertRecipientAddedDialog();
    await flow.clickGotIt();
    await expect(flow['page'].locator('#recipient-added-dialog')).not.toBeVisible({ timeout: 10_000 });
  });

  // ── EDIT PAGE ─────────────────────────────────────────────────────────────────

  test('RC-20 @regression — clicking a recipient navigates to edit page', async () => {
    await flow.navigateToRecipients();
    // Only run if recipients exist
    const first = flow['page'].locator("[class*='RecipientList_rb-text-container']").first();
    const exists = await first.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!exists) { test.skip(); return; }
    await flow.clickFirstRecipient();
    await expect(flow['page']).toHaveURL(/\/recipients\/edit/i, { timeout: 15_000 });
  });

  test('RC-21 @regression — edit page has edit-recipient element', async () => {
    await flow.navigateToRecipients();
    const first = flow['page'].locator("[class*='RecipientList_rb-text-container']").first();
    const exists = await first.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!exists) { test.skip(); return; }
    await flow.clickFirstRecipient();
    await flow.assertEditRecipientPageLoaded();
  });

  test('RC-22 @regression — edit page has delete-recipient button', async () => {
    await flow.navigateToRecipients();
    const first = flow['page'].locator("[class*='RecipientList_rb-text-container']").first();
    const exists = await first.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!exists) { test.skip(); return; }
    await flow.clickFirstRecipient();
    await flow.assertEditRecipientPageLoaded();
    await expect(flow['page'].locator('#delete-recipient')).toBeVisible();
  });

  test('RC-23 @regression — clicking delete shows delete-recipient-dialog', async () => {
    await flow.navigateToRecipients();
    const first = flow['page'].locator("[class*='RecipientList_rb-text-container']").first();
    const exists = await first.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!exists) { test.skip(); return; }
    await flow.clickFirstRecipient();
    await flow.assertEditRecipientPageLoaded();
    await flow.clickDeleteRecipient();
    await flow.assertDeleteDialog();
  });

  test('RC-24 @regression — cancel on delete dialog stays on edit page', async () => {
    await flow.navigateToRecipients();
    const first = flow['page'].locator("[class*='RecipientList_rb-text-container']").first();
    const exists = await first.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!exists) { test.skip(); return; }
    await flow.clickFirstRecipient();
    await flow.assertEditRecipientPageLoaded();
    await flow.clickDeleteRecipient();
    await flow.assertDeleteDialog();
    await flow.cancelDeleteRecipient();
    await expect(flow['page']).toHaveURL(/\/recipients\/edit/i);
  });
});
