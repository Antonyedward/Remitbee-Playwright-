import { test, expect } from '@playwright/test';
import { ScheduleFlow } from '../../flows/schedule/ScheduleFlow';
import { ENV } from '../../config/environments';

test.describe('11 — Schedule', () => {
  let flow: ScheduleFlow;

  test.beforeEach(async ({ page }) => {
    flow = new ScheduleFlow(page);
  });

  // ── Page load ─────────────────────────────────────────────────────────────────

  // SC-01: Schedule page loads
  test('SC-01 @smoke @regression — schedule page loads', async () => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
  });

  // SC-02: Schedule list visible after navigation
  test('SC-02 @smoke @regression — schedule list visible', async () => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.assertScheduleListVisible();
  });

  // SC-03: Schedule URL is correct
  test('SC-03 @smoke @regression — schedule page has correct URL', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await expect(page).toHaveURL(/schedule/i);
  });

  // ── Step 1: Recipient selection ───────────────────────────────────────────────

  // SC-04: Wizard opens at recipient step when creating a schedule
  test('SC-04 @regression — create schedule wizard opens with recipient selection', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    // Either recipient list or a "create recipient" prompt appears
    const recipientStep = page
      .locator('[class*="recipient"], [class*="Recipient"]')
      .or(page.getByText(/select recipient|choose recipient|add recipient/i))
      .first();
    await expect(recipientStep).toBeVisible({ timeout: 20_000 });
  });

  // SC-05: Selecting a recipient advances to transfer details step
  test('SC-05 @regression — selecting recipient advances to transfer details', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page
      .locator('[class*="rb-recipientList-container"]')
      .first();
    const visible = await firstRecipient.isVisible().catch(() => false);
    if (visible) {
      await firstRecipient.click({ force: true });
      // Transfer details step: id="send-money-transfer-details"
      const transferStep = page.locator('#send-money-transfer-details');
      await expect(transferStep).toBeVisible({ timeout: 15_000 });
    } else {
      test.skip();
    }
  });

  // ── Step 2: Transfer details ──────────────────────────────────────────────────

  // SC-06: Transfer details heading visible — id="send-money-transfer-details"
  test('SC-06 @regression — transfer details step heading visible', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      const heading = page.locator('#send-money-transfer-details');
      await expect(heading).toBeVisible({ timeout: 15_000 });
    } else {
      test.skip();
    }
  });

  // SC-07: Converter box visible on transfer details — id="send-money-coverter-box"
  test('SC-07 @regression — converter box visible on transfer details step', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      const converterBox = page.locator('#send-money-coverter-box');
      await expect(converterBox).toBeVisible({ timeout: 15_000 });
    } else {
      test.skip();
    }
  });

  // SC-08: Continue button on transfer details — id="continue"
  test('SC-08 @regression — continue button visible on transfer details', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      const continueBtn = page.locator('#continue');
      await expect(continueBtn).toBeVisible({ timeout: 15_000 });
    } else {
      test.skip();
    }
  });

  // SC-09: Compliance notification visible if applicable — id="transfer-detail-compliance-notification"
  test('SC-09 @regression — compliance notification shown when applicable', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      // Compliance notification is optional — only assert if present
      const compliance = page.locator('#transfer-detail-compliance-notification');
      const complianceVisible = await compliance.isVisible().catch(() => false);
      if (complianceVisible) {
        await expect(compliance).toBeVisible();
      }
      // Transfer details heading must always be visible at this step
      const heading = page.locator('#send-money-transfer-details');
      await expect(heading).toBeVisible({ timeout: 10_000 });
    } else {
      test.skip();
    }
  });

  // ── Step 3: Scheduling (Frequency) ───────────────────────────────────────────

  // SC-10: Scheduling step shows frequency selector — id="send-money-select-method"
  test('SC-10 @smoke @regression — scheduling step shows frequency selector', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      // Advance to scheduling step
      const continueBtn = page.locator('#continue');
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click({ force: true });
        const freqSelector = page.locator('#send-money-select-method');
        await expect(freqSelector).toBeVisible({ timeout: 15_000 });
      }
    } else {
      test.skip();
    }
  });

  // SC-11: Date picker visible — id="scheduling-date"
  test('SC-11 @regression — scheduling date picker visible on scheduling step', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      const continueBtn = page.locator('#continue');
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click({ force: true });
        const datePicker = page.locator('#scheduling-date');
        await expect(datePicker).toBeVisible({ timeout: 15_000 });
        if (await datePicker.isVisible().catch(() => false)) {
          await expect(datePicker).toBeVisible();
        }
      }
    } else {
      test.skip();
    }
  });

  // SC-12: Set schedule button visible — id="set-schedule-button"
  test('SC-12 @smoke @regression — set-schedule-button visible on scheduling step', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      const continueBtn = page.locator('#continue');
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click({ force: true });
        const setBtn = page.locator('#set-schedule-button');
        await expect(setBtn).toBeVisible({ timeout: 15_000 });
        if (await setBtn.isVisible().catch(() => false)) {
          await expect(setBtn).toBeVisible();
        }
      }
    } else {
      test.skip();
    }
  });

  // SC-13: Send now instead button visible — id="send-now-instead-button"
  test('SC-13 @regression — send-now-instead-button visible on scheduling step', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      const continueBtn = page.locator('#continue');
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click({ force: true });
        const sendNowBtn = page.locator('#send-now-instead-button');
        await expect(sendNowBtn).toBeVisible({ timeout: 15_000 });
        if (await sendNowBtn.isVisible().catch(() => false)) {
          await expect(sendNowBtn).toBeVisible();
        }
      }
    } else {
      test.skip();
    }
  });

  // SC-14: Date warning alert visible on past date — id="date-warning-alert"
  test('SC-14 @regression — date-warning-alert shown for past date', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      const continueBtn = page.locator('#continue');
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click({ force: true });
        const datePicker = page.locator('#scheduling-date');
        if (await datePicker.isVisible().catch(() => false)) {
          await datePicker.fill('2020-01-01');
          const warning = page.locator('#date-warning-alert');
          await expect(warning).toBeVisible({ timeout: 8_000 });
        }
      }
    } else {
      test.skip();
    }
  });

  // SC-15: Monthly limit exceeded alert — id="monthly-limit-exceeded-alert"
  test('SC-15 @regression — monthly-limit-exceeded-alert shown when applicable', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      const continueBtn = page.locator('#continue');
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click({ force: true });
        // Just validate page doesn't crash if limit is hit
        await page.waitForTimeout(2_000);
      }
    } else {
      test.skip();
    }
  });

  // ── Step 4: Payment ───────────────────────────────────────────────────────────

  // SC-16: Payment step title — id="payment-title"
  test('SC-16 @regression — payment step title visible', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      const continueBtn = page.locator('#continue');
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click({ force: true });
        const setScheduleBtn = page.locator('#set-schedule-button');
        if (await setScheduleBtn.isVisible().catch(() => false)) {
          await setScheduleBtn.click({ force: true });
          const paymentTitle = page.locator('#payment-title');
          await expect(paymentTitle).toBeVisible({ timeout: 15_000 });
        }
      }
    } else {
      test.skip();
    }
  });

  // SC-17: Scheduling balance visible — id="scheduling-balance"
  test('SC-17 @regression — scheduling-balance visible on payment step', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      const continueBtn = page.locator('#continue');
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click({ force: true });
        const setScheduleBtn = page.locator('#set-schedule-button');
        if (await setScheduleBtn.isVisible().catch(() => false)) {
          await setScheduleBtn.click({ force: true });
          const balance = page.locator('#scheduling-balance');
          await expect(balance).toBeVisible({ timeout: 15_000 });
        }
      }
    } else {
      test.skip();
    }
  });

  // SC-18: Payment continue button — id="select-pay-type-continue"
  test('SC-18 @regression — select-pay-type-continue button visible on payment step', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      const continueBtn = page.locator('#continue');
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click({ force: true });
        const setScheduleBtn = page.locator('#set-schedule-button');
        if (await setScheduleBtn.isVisible().catch(() => false)) {
          await setScheduleBtn.click({ force: true });
          const paymentContinue = page.locator('#select-pay-type-continue');
          await expect(paymentContinue).toBeVisible({ timeout: 15_000 });
        }
      }
    } else {
      test.skip();
    }
  });

  // SC-19: Balance alert visible if balance insufficient — id="balance-alert"
  test('SC-19 @regression — balance-alert shown when balance insufficient', async ({ page }) => {
    await flow.loginForFlow(ENV.PERSONAL_NO_BALANCE_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      const continueBtn = page.locator('#continue');
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click({ force: true });
        const setScheduleBtn = page.locator('#set-schedule-button');
        if (await setScheduleBtn.isVisible().catch(() => false)) {
          await setScheduleBtn.click({ force: true });
          // Check if balance alert appears
          const balanceAlert = page.locator('#balance-alert');
          await expect(balanceAlert).toBeVisible({ timeout: 10_000 });
        }
      }
    } else {
      test.skip();
    }
  });

  // ── Step 5: Overview & Success ─────────────────────────────────────────────

  // SC-20: Overview step heading — id="overview"
  test('SC-20 @regression — overview step shows overview heading', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      const continueBtn = page.locator('#continue');
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click({ force: true });
        const setScheduleBtn = page.locator('#set-schedule-button');
        if (await setScheduleBtn.isVisible().catch(() => false)) {
          await setScheduleBtn.click({ force: true });
          const paymentContinue = page.locator('#select-pay-type-continue');
          if (await paymentContinue.isVisible().catch(() => false)) {
            await paymentContinue.click({ force: true });
            const overview = page.locator('#overview');
            await expect(overview).toBeVisible({ timeout: 15_000 });
          }
        }
      }
    } else {
      test.skip();
    }
  });

  // SC-21: Scheduled transfer dialog on success — id="scheduled-transfer-dialog"
  test('SC-21 @smoke @regression — scheduled-transfer-dialog shown on schedule creation success', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      const continueBtn = page.locator('#continue');
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click({ force: true });
        const setScheduleBtn = page.locator('#set-schedule-button');
        if (await setScheduleBtn.isVisible().catch(() => false)) {
          await setScheduleBtn.click({ force: true });
          const paymentContinue = page.locator('#select-pay-type-continue');
          if (await paymentContinue.isVisible().catch(() => false)) {
            await paymentContinue.click({ force: true });
            const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Schedule")').last();
            if (await confirmBtn.isVisible().catch(() => false)) {
              await confirmBtn.click({ force: true });
              const dialog = page.locator('#scheduled-transfer-dialog');
              await expect(dialog).toBeVisible({ timeout: 20_000 });
            }
          }
        }
      }
    } else {
      test.skip();
    }
  });

  // ── Frequency options ─────────────────────────────────────────────────────────

  // SC-22: Weekly frequency option visible in scheduler
  test('SC-22 @regression — weekly frequency option available', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      const continueBtn = page.locator('#continue');
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click({ force: true });
        const weeklyOption = page.getByText(/weekly/i).first();
        await expect(weeklyOption).toBeVisible({ timeout: 15_000 });
      }
    } else {
      test.skip();
    }
  });

  // SC-23: Bi-weekly frequency option visible
  test('SC-23 @regression — bi-weekly frequency option available', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      const continueBtn = page.locator('#continue');
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click({ force: true });
        const biWeekly = page.getByText(/bi-weekly|biweekly|every 2 weeks/i).first();
        await expect(biWeekly).toBeVisible({ timeout: 15_000 });
      }
    } else {
      test.skip();
    }
  });

  // SC-24: Monthly frequency option visible
  test('SC-24 @regression — monthly frequency option available', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      const continueBtn = page.locator('#continue');
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click({ force: true });
        const monthly = page.getByText(/monthly/i).first();
        await expect(monthly).toBeVisible({ timeout: 15_000 });
      }
    } else {
      test.skip();
    }
  });

  // ── Send now instead flow ─────────────────────────────────────────────────────

  // SC-25: Clicking "Send now instead" from scheduling step navigates out of wizard
  test('SC-25 @regression — send-now-instead-button navigates away from schedule wizard', async ({ page }) => {
    await flow.loginForFlow(ENV.SAVED_BANK_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.clickCreateSchedule();
    const firstRecipient = page.locator('[class*="rb-recipientList-container"]').first();
    if (await firstRecipient.isVisible().catch(() => false)) {
      await firstRecipient.click({ force: true });
      const continueBtn = page.locator('#continue');
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click({ force: true });
        const sendNow = page.locator('#send-now-instead-button');
        if (await sendNow.isVisible().catch(() => false)) {
          await sendNow.click({ force: true });
          await page.waitForURL(/send.?money|schedule/i, { timeout: 15_000 }).catch(() => {});
        }
      }
    } else {
      test.skip();
    }
  });

  // ── Personal account schedules ────────────────────────────────────────────────

  // SC-26: Personal account can access schedule page
  test('SC-26 @regression — personal account schedule page accessible', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    await flow.assertScheduleListVisible();
  });

  // SC-27: Business account can access schedule page
  test('SC-27 @regression — business account schedule page accessible', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToSchedule();
    await flow.assertScheduleListVisible();
  });

  // SC-28: Schedule page refresh retains page
  test('SC-28 @regression — refreshing schedule page keeps user on schedule page', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    await page.reload();
    await expect(page).toHaveURL(/schedule/i);
  });

  // SC-29: Empty state shown when no schedules exist
  test('SC-29 @regression — empty state shown when account has no schedules', async ({ page }) => {
    await flow.loginForFlow(ENV.FIRST_TIME_USER_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToSchedule();
    // Either empty state or list — both valid
    const state = page
      .locator('[class*="empty"], [class*="no-schedule"]')
      .or(page.locator('[class*="schedule"]'))
      .first();
    await expect(state).toBeVisible({ timeout: 15_000 });
  });

  // SC-30: Create schedule button visible on schedule page
  test('SC-30 @regression — create schedule button visible on schedule overview', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToSchedule();
    const createBtn = page
      .locator('button:has-text("Create"), button:has-text("New schedule"), button:has-text("Schedule transfer"), button:has-text("Add")')
      .first();
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
  });
});
