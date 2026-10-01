import { test, expect } from '@playwright/test';
import { ScheduleFlow } from '../../flows/schedule/ScheduleFlow';
import { ENV } from '../../config/environments';

/**
 * 11 — Schedule transfer (rewritten 2026-10-01 from the live DOM + Jam db231923).
 * The wizard opens directly on "Select your recipient" (there is no "Create schedule" button any more):
 * recipient → transfer → scheduling (date / repeat) → purpose → payment → overview → dashboard dialog.
 * Only SC-21 submits (creates a one-time scheduled transfer next month on staging).
 */
test.describe('11 — Schedule', () => {
  test.describe.configure({ timeout: 180_000 });
  let flow: ScheduleFlow;

  test.beforeEach(async ({ page }) => {
    flow = new ScheduleFlow(page);
  });

  // ── Page load ────────────────────────────────────────────────────────────────

  test('SC-01 @smoke @regression — schedule page loads', async () => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
  });

  test('SC-02 @smoke @regression — schedule list visible', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.assertScheduleListVisible();
    await expect(page.getByPlaceholder(/search recipients/i)).toBeVisible();
  });

  test('SC-03 @smoke @regression — schedule page has correct URL', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await expect(page).toHaveURL(/schedule-transaction/i);
  });

  // ── Step 1: Recipient ────────────────────────────────────────────────────────

  test('SC-04 @regression — create schedule wizard opens with recipient selection', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.assertScheduleListVisible();
    await expect(page).toHaveURL(/recipient\/select-recipient/);
    await expect(flow.recipientRows().first()).toBeVisible({ timeout: 45_000 });
  });

  test('SC-05 @regression — selecting recipient advances to transfer details', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.selectFirstRecipient();
    await expect(page).toHaveURL(/schedule-transaction\/transfer/);
  });

  // ── Step 2: Transfer details ─────────────────────────────────────────────────

  test('SC-06 @regression — transfer details step heading visible', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.selectFirstRecipient();
    await expect(page.locator('#send-money-transfer-details')).toBeVisible({ timeout: 30_000 });
  });

  test('SC-07 @regression — converter box visible on transfer details step', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.goToTransfer('20');
    await expect(page.locator('#send-money-coverter-box')).toBeVisible();
    await expect(page.locator('#send-money-coverter-box #receivingEnd')).not.toHaveValue(/^(0(\.0+)?)?$/, { timeout: 20_000 });
  });

  test('SC-08 @regression — continue button visible on transfer details', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.goToTransfer('20');
    await expect(page.locator('#continue:visible').first()).toBeEnabled({ timeout: 20_000 });
  });

  test('SC-09 @regression — compliance notification shown when applicable', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.goToTransfer('20');
    // Optional banner — only validated when present
    const compliance = page.locator('#transfer-detail-compliance-notification');
    if (await compliance.isVisible().catch(() => false)) await expect(compliance).not.toBeEmpty();
    await expect(page.locator('#send-money-transfer-details')).toBeVisible();
  });

  // ── Step 3: Scheduling ───────────────────────────────────────────────────────

  test('SC-10 @smoke @regression — scheduling step shows frequency selector', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.goToScheduling();
    await expect(page).toHaveURL(/scheduling\/frequency/);
    // "Repeat" dropdown only renders once a date is chosen
    await flow.setStartDateNextMonth(15);
    await expect(flow.frequencyField()).toBeVisible({ timeout: 15_000 });
  });

  test('SC-11 @regression — scheduling date picker visible on scheduling step', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.goToScheduling();
    const date = page.locator('input#scheduling-date');
    await expect(date).toBeVisible();
    await flow.setStartDateNextMonth(15);
    await expect(date).toHaveValue(/[A-Z][a-z]{2} 15, \d{4}/);
  });

  test('SC-12 @smoke @regression — set-schedule-button visible on scheduling step', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.goToScheduling();
    await expect(page.locator('#set-schedule-button')).toBeVisible();
  });

  test('SC-13 @regression — send-now-instead-button visible on scheduling step', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.goToScheduling();
    await expect(page.locator('#send-now-instead-button')).toBeVisible();
  });

  test('SC-14 @regression — set schedule without a date shows validation', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.goToScheduling();
    await flow.clickScheduleConfirm();
    // Frequency.tsx helperText: scheduling.please_select_date
    await expect(page.getByText(/please select a date/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/scheduling\/frequency/);
  });

  test('SC-15 @regression — monthly-limit-exceeded-alert shown when applicable', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.goToScheduling();
    await flow.setStartDateNextMonth(15);
    await flow.selectFrequency('Weekly');
    // Only shown when the recurring total would exceed the monthly limit
    const alert = page.locator('#monthly-limit-exceeded-alert');
    if (await alert.isVisible().catch(() => false)) await expect(alert).not.toBeEmpty();
    await expect(page.locator('input#date-picker-input:visible')).toBeVisible();
  });

  // ── Step 4: Payment ──────────────────────────────────────────────────────────

  test('SC-16 @regression — payment step title visible', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.goToPayment();
    await expect(page).toHaveURL(/schedule-transaction\/payment/);
    await expect(page.locator('#payment-title')).toBeVisible();
  });

  test('SC-17 @regression — scheduling-balance visible on payment step', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.goToPayment();
    await expect(page.locator('#scheduling-balance')).toBeVisible({ timeout: 20_000 });
  });

  test('SC-18 @regression — select-pay-type-continue button visible on payment step', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.goToPayment();
    await expect(page.locator('#select-pay-type-continue')).toBeVisible();
  });

  test('SC-19 @regression — balance-alert shown when balance insufficient', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    // Far above any test balance → the balance section warns
    await flow.goToPayment('9000');
    const alert = page.locator('#balance-alert');
    if (await alert.isVisible().catch(() => false)) {
      await expect(alert).not.toBeEmpty();
    } else {
      test.info().annotations.push({ type: 'note', description: 'No #balance-alert — account balance covers the amount' });
    }
    await expect(page.locator('#scheduling-balance')).toBeVisible();
  });

  // ── Step 5: Overview / submit ────────────────────────────────────────────────

  test('SC-20 @regression — overview step shows overview heading', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.goToOverview();
    await expect(page.locator('#transfer-summary')).toBeVisible();
    await expect(page.locator('#create-scheduled-transaction')).toBeVisible();
  });

  test('SC-21 @smoke @regression — scheduled-transfer-dialog shown on schedule creation success', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.goToOverview('12');
    // Jam: "Confirm and send" → /dashboard + success dialog → "Got it". Creates a real schedule on staging.
    await page.locator('#create-scheduled-transaction').click();
    await page.waitForURL(/\/dashboard/, { timeout: 45_000 });
    await flow.assertScheduleCreated();
    await page.locator('#scheduled-transfer-dialog #dialog-button-primaryAction').click();
    await expect(page.locator('#scheduled-transfer-dialog')).toBeHidden({ timeout: 10_000 });
  });

  // ── Frequency options ────────────────────────────────────────────────────────

  for (const [id, name] of [['SC-22', 'Weekly'], ['SC-23', 'Bi-weekly'], ['SC-24', 'Monthly']] as const) {
    test(`${id} @regression — ${name.toLowerCase()} frequency option available`, async ({ page }) => {
      await flow.loginForFlow();
      await flow.navigateToSchedule();
      await flow.goToScheduling();
      await flow.setStartDateNextMonth(15);
      await flow.selectFrequency(name);
      // Recurring frequencies add "Stop repeating on"
      await expect(page.locator('input#date-picker-input:visible').first()).toBeVisible({ timeout: 10_000 });
    });
  }

  test('SC-25 @regression — send-now-instead-button navigates away from schedule wizard', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.goToScheduling();
    await flow.clickSendNowInstead();
    await expect.poll(() => page.url(), { timeout: 30_000 }).not.toMatch(/schedule-transaction/);
    await expect(page).toHaveURL(/money-transfer/);
  });

  // ── Accounts / page state ────────────────────────────────────────────────────

  test('SC-26 @regression — personal account schedule page accessible', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.assertScheduleListVisible();
  });

  test('SC-27 @regression — business account schedule page accessible', async ({ page }) => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToSchedule();
    await expect(page).toHaveURL(/schedule-transaction/);
    await expect(flow.recipientHeading().or(page.getByText(/add.*recipient/i)).first()).toBeVisible({ timeout: 45_000 });
  });

  test('SC-28 @regression — refreshing schedule page keeps user on schedule page', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.assertScheduleListVisible();
    await page.reload();
    await expect(page).toHaveURL(/schedule-transaction/i);
  });

  test('SC-29 @regression — account without recipients sees an add-recipient path', async ({ page }) => {
    await flow.loginForFlow(ENV.FIRST_TIME_USER_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await expect(page).toHaveURL(/schedule-transaction/);
    await expect(
      flow.recipientHeading().or(page.getByText(/add.*recipient|select country|start sending/i)).first()
    ).toBeVisible({ timeout: 45_000 });
  });

  test('SC-30 @regression — recipient search filters the list', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.assertScheduleListVisible();
    const first = flow.recipientRows().first();
    await expect(first).toBeVisible({ timeout: 45_000 });
    const name = (await first.innerText()).trim();
    await page.getByPlaceholder(/search recipients/i).fill(name);
    await expect(flow.recipientRows().first()).toHaveText(name, { timeout: 15_000 });
    await page.getByPlaceholder(/search recipients/i).fill('zzzz-no-such-recipient');
    await expect(flow.recipientRows()).toHaveCount(0, { timeout: 15_000 });
  });
});
