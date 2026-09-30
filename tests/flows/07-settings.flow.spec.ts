import { test, expect } from '@playwright/test';
import { SettingsFlow } from '../../flows/settings/SettingsFlow';
import { ENV } from '../../config/environments';

/**
 * 07 — Settings (rewritten 2026-09-30 from the live DOM + Jam recordings).
 * Sending-limits tests removed: that tab no longer exists in Settings (commented out in Settings.tsx).
 *
 * State-changing tests (ST-05, ST-07, ST-08, ST-10, ST-14) always put the account back the way
 * they found it, so the suite can be re-run. They all use the default flow account (PERSONAL_EMAIL).
 */
test.describe('07 — Settings', () => {
  test.describe.configure({ timeout: 150_000 });
  let flow: SettingsFlow;

  test.beforeEach(async ({ page }) => {
    flow = new SettingsFlow(page);
    await flow.loginForFlow();
    await flow.navigateToSettings();
  });

  // ── General ──────────────────────────────────────────────────────────────────

  test('ST-01 @smoke @regression — settings page loads on the security tab', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /2-step verification/i })).toBeVisible({ timeout: 30_000 });
  });

  test('ST-02 @regression — all six settings tabs are shown', async ({ page }) => {
    for (const tab of SettingsFlow.TABS) {
      await expect(page.locator(`#${tab}:visible`).first()).toBeVisible({ timeout: 15_000 });
    }
    await expect(page.getByText(/sending limits/i)).toHaveCount(0);
  });

  // ── Security ─────────────────────────────────────────────────────────────────

  test('ST-03 @smoke @regression — security tab shows 2-step verification status and action', async ({ page }) => {
    await flow.openTab('security');
    const status = await flow.getTwoStepStatus();
    await expect(flow.twoStepStatus()).toHaveText(status);
    await expect(page.locator(status === 'ON' ? '#turn-off' : '#activate')).toBeVisible();
    await expect(page.getByRole('heading', { name: /recent logins/i })).toBeVisible();
  });

  test('ST-04 @regression — deactivate asks for confirmation; "No" keeps 2-step on', async ({ page }) => {
    await flow.openTab('security');
    test.skip(await flow.getTwoStepStatus() === 'OFF', '2-step is OFF on this account — nothing to deactivate');
    await page.locator('#turn-off').click();
    await flow.assertTurnOffDialog();
    await page.locator('#turn-off-dialog #dialog-button-secondaryAction').click(); // "No"
    await expect(page.locator('#turn-off-dialog')).toBeHidden({ timeout: 10_000 });
    await expect(page.locator('#turn-off')).toBeVisible();
    await expect(flow.twoStepStatus()).toHaveText('ON');
  });

  test('ST-05 @smoke @regression — 2-step verification can be deactivated and activated again', async () => {
    await flow.openTab('security');
    // Jam 01df64d4: Activate → SMS code → Continue → Got it; Deactivate → Yes → SMS code → Continue → Got it.
    // Whatever state the account starts in, flip it and flip it back.
    if (await flow.getTwoStepStatus() === 'ON') {
      await flow.deactivateTwoStep();
      await flow.activateTwoStep();
    } else {
      await flow.activateTwoStep();
      await flow.deactivateTwoStep();
    }
  });

  // ── Notifications ────────────────────────────────────────────────────────────

  test('ST-06 @regression — notifications tab shows allow toggle and preference rows', async ({ page }) => {
    await flow.openTab('notifications');
    await flow.ensureNotificationsAllowed();
    await expect(page.getByText(/balance updates/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/marketing updates/i).first()).toBeVisible();
    for (const key of ['noti_wallet_update_email', 'noti_marketing_email', 'noti_marketing_sms', 'noti_referral_sms']) {
      await expect(flow.notificationToggle(key)).toBeVisible();
    }
  });

  test('ST-07 @smoke @regression — a notification toggle turns off and on and is saved', async ({ page }) => {
    await flow.openTab('notifications');
    await flow.ensureNotificationsAllowed();
    const key = 'noti_marketing_email';
    const toggle = flow.notificationToggle(key);
    await toggle.waitFor({ state: 'visible', timeout: 15_000 });
    const original = await SettingsFlow.isToggleOn(toggle);

    for (const target of [!original, original]) {
      await toggle.click();
      await flow.expectToggle(toggle, target);
      // Auto-save fires 500ms after the click — reload to prove it persisted.
      await page.waitForTimeout(2_500);
      await expect(async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await flow.expectToggle(flow.notificationToggle(key), target, 10_000);
      }).toPass({ timeout: 45_000, intervals: [2_000, 3_000] });
    }
  });

  test('ST-08 @regression — "Allow notifications" off hides the preferences, on shows them again', async ({ page }) => {
    await flow.openTab('notifications');
    await flow.ensureNotificationsAllowed();
    const master = flow.allowNotificationsToggle();
    const row = page.locator('#toggle-noti_marketing_email');

    await master.click();
    await flow.expectToggle(master, false);
    await expect(row).toHaveCount(0, { timeout: 15_000 });

    await master.click(); // restore
    await flow.expectToggle(master, true);
    await expect(row.first()).toBeVisible({ timeout: 20_000 });
  });

  // ── Payment preferences ─────────────────────────────────────────────────────

  test('ST-09 @regression — payment preferences shows the preferred bank section', async ({ page }) => {
    await flow.openTab('payment-preferences');
    await expect(page.getByText('Preferred bank', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#change-bank, #connect-bank').first()).toBeVisible({ timeout: 30_000 });
  });

  test('ST-10 @smoke @regression — preferred bank can be changed', async () => {
    await flow.openTab('payment-preferences');
    // Jam 674a45f6: Change → pick a bank in the list → card shows the new bank.
    const original = await flow.getPreferredBank(); // logo src — list and card name the bank differently
    const before = (await flow.preferredBankCard().innerText().catch(() => '')).trim();
    const chosen = await flow.choosePreferredBank({ excludeSrc: original });
    expect(chosen).not.toBe(original);
    await expect(flow.preferredBankCard()).not.toHaveText(before);
    if (original) await flow.choosePreferredBank({ src: original }); // put it back
  });

  // ── Change password ─────────────────────────────────────────────────────────

  test('ST-11 @regression — change password form fields are shown', async ({ page }) => {
    await flow.openTab('change-password');
    for (const id of ['#current_password', '#new_password', '#confirm_new_password']) {
      await expect(page.locator(id)).toBeVisible({ timeout: 20_000 });
    }
    await expect(page.locator('#save:visible').first()).toHaveText(/update password/i);
  });

  test('ST-12 @smoke @regression — new password same as current shows "not used before" error', async ({ page }) => {
    await flow.openTab('change-password');
    // Jam bf5ea273. Re-using the current password is rejected, so the password never changes.
    await flow.fillChangePassword(ENV.USER_PASSWORD, ENV.USER_PASSWORD);
    await flow.clickUpdatePassword();
    await expect(flow.snackbar(/choose a password that you have not used before/i)).toBeVisible({ timeout: 20_000 });
    await expect(flow.snackbar(/password updated successfully/i)).toHaveCount(0);
    await expect(page).toHaveURL(/step=change-password/);
  });

  // ── Rates subscriptions ─────────────────────────────────────────────────────

  test('ST-13 @regression — rates subscriptions shows methods and frequency', async ({ page }) => {
    await flow.openTab('rates-subscriptions');
    await expect(flow.ratesToggle('Email notifications')).toBeVisible({ timeout: 20_000 });
    await expect(flow.ratesToggle('Push notifications')).toBeVisible();
    for (const id of ['#daily', '#weekly', '#monthly']) {
      await expect(page.locator(`${id}:visible`).first()).toBeVisible();
    }
  });

  test('ST-14 @smoke @regression — rates email toggle turns off and on and is saved', async ({ page }) => {
    await flow.openTab('rates-subscriptions');
    // Jam 91afdef8: toggle clicked on/off repeatedly — each click auto-saves.
    const toggle = flow.ratesToggle('Email notifications');
    await toggle.waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForTimeout(1_000); // preferences load after first paint
    const original = await SettingsFlow.isToggleOn(toggle);

    for (const target of [!original, original]) {
      await toggle.click();
      await flow.expectToggle(toggle, target);
      await page.waitForTimeout(2_500);
      await expect(async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await flow.expectToggle(flow.ratesToggle('Email notifications'), target, 10_000);
      }).toPass({ timeout: 45_000, intervals: [2_000, 3_000] });
    }
  });

  // ── Delete account ──────────────────────────────────────────────────────────

  test('ST-15 @regression — delete account shows Delete and Keep buttons (not clicked)', async ({ page }) => {
    await flow.openTab('delete-account');
    await expect(page.getByText('Are you sure?').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#delete-account-1')).toBeVisible();
    await expect(page.locator('#delete-account-1')).toBeEnabled();
    await expect(page.locator('#keep-account-1')).toBeVisible();
  });
});
