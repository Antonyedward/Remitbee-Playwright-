import { Page, Locator, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';
import { ENV } from '../../config/environments';

/**
 * Settings helper. Selectors verified against remitbee-cp source (src/components/settingsV2/**)
 * and Jam recordings of the manual flows (2026-09-30).
 *
 * Desktop /settings renders <Tabs> (remitbee/components/tab/Tab.tsx): each tab label gets
 * id = label kebab-cased → #security #notifications #payment-preferences #change-password
 * #rates-subscriptions #delete-account.  Direct nav: /settings?step=<same slug>.
 * (Sending limits was removed from Settings — it is commented out in Settings.tsx.)
 *
 *  Security            Security.tsx — status "2-step verification: ON|OFF", #activate / #turn-off,
 *                      #turn-off-dialog (Yes = #dialog-button-primaryAction), SMS code #code-1..6,
 *                      #verify_code, success splash #got-it. Snackbar "Security preference updated."
 *  Notifications       NotificationPreferencesV2.tsx — #toggle-allow-notifications (master),
 *                      rows #toggle-noti_<group>_<email|sms|push>; auto-saves 500ms after a click.
 *  Payment preferences PreferredBank.tsx — #change-bank (bank set) / #connect-bank (none),
 *                      #preferred-bank-dialog with BankListItem rows ([class*="rb-bankName-wrapper"]).
 *  Change password     ChangePassword.tsx — #current_password #new_password #confirm_new_password #save;
 *                      errors are snackbars: div[id="snackbar-<message>"].
 *  Rates subscriptions RatesSubscriptions.tsx — Email/Push notification toggles (no ids),
 *                      frequency radios #daily #weekly #monthly; auto-saves on toggle.
 *  Delete account      DeleteAccount/Confirmation.tsx — #delete-account-1, #keep-account-1.
 *
 * Toggle (remitbee/components/toggle/Toggle.tsx): <div class="Toggle_rb-toggle-switch(-checked)__x">.
 */
export type SettingsTab =
  | 'security' | 'notifications' | 'payment-preferences'
  | 'change-password' | 'rates-subscriptions' | 'delete-account';

export class SettingsFlow extends FlowBase {
  static readonly TABS: SettingsTab[] = [
    'security', 'notifications', 'payment-preferences',
    'change-password', 'rates-subscriptions', 'delete-account',
  ];

  constructor(page: Page) {
    super(page);
  }

  private permissionHandlerAdded = false;

  /**
   * Playwright's browser has notification permission "denied", so NotificationPreferencesV2 opens
   * #notification-permission-dialog ("Your notifications are turned off") on the Notifications tab.
   * Its overlay swallows clicks — dismiss it ("Got it") whenever it shows up.
   */
  private async handleNotificationPermissionDialog(): Promise<void> {
    if (this.permissionHandlerAdded) return;
    this.permissionHandlerAdded = true;
    const dialog = this.page.locator('#notification-permission-dialog');
    await this.page.addLocatorHandler(dialog, async () => {
      await dialog.locator('#dialog-button-primaryAction').click();
      await dialog.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
    });
  }

  async navigateToSettings(): Promise<void> {
    await this.handleNotificationPermissionDialog();
    await this.navigateSidebar('Settings');
    await this.page.waitForURL(/settings/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
    await expect(this.page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible({ timeout: 30_000 });
  }

  // Older specs call clickTab('Security') etc. — map friendly names onto the step slugs.
  private static readonly ALIASES: Record<string, SettingsTab> = {
    'security': 'security', 'profile': 'security',
    'notifications': 'notifications', 'notification': 'notifications',
    'payment': 'payment-preferences', 'payment preferences': 'payment-preferences', 'payment-preferences': 'payment-preferences',
    'password': 'change-password', 'change password': 'change-password', 'change-password': 'change-password',
    'rates': 'rates-subscriptions', 'rates subscriptions': 'rates-subscriptions', 'rates-subscriptions': 'rates-subscriptions',
    'delete': 'delete-account', 'delete account': 'delete-account', 'delete-account': 'delete-account',
  };

  /** Click the tab label (as a user does) and wait for ?step=<slug>. */
  async openTab(tab: SettingsTab | string): Promise<void> {
    const slug = SettingsFlow.ALIASES[tab.toLowerCase().trim()] ?? (tab as SettingsTab);
    const label = this.page.locator(`#${slug}:visible`).first();
    await label.waitFor({ state: 'visible', timeout: 30_000 });
    try {
      await expect(async () => {
        await label.click();
        await expect(this.page).toHaveURL(new RegExp(`step=${slug}`), { timeout: 5_000 });
      }).toPass({ timeout: 20_000, intervals: [500, 1_000, 2_000] });
    } catch {
      // Tab click swallowed while the page was still hydrating — use the same route the tab pushes.
      await this.page.goto(`${ENV.BASE_URL}/settings?step=${slug}`, { waitUntil: 'domcontentloaded' });
    }
    // Tab contents load their data after first paint (toggles render OFF until then) — let it settle.
    await this.page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  }

  async clickTab(tabName: string): Promise<void> {
    await this.openTab(tabName);
  }

  /** Snackbar alert: CP renders div id="snackbar-<message>". */
  snackbar(text: RegExp | string): Locator {
    return this.page.locator('[id^="snackbar-"]').filter({ hasText: text }).first();
  }

  // ── Toggles ─────────────────────────────────────────────────────────────────

  static async isToggleOn(toggle: Locator): Promise<boolean> {
    return /rb-toggle-switch-checked/.test((await toggle.getAttribute('class')) ?? '');
  }

  async expectToggle(toggle: Locator, on: boolean, timeout = 15_000): Promise<void> {
    await expect(toggle).toHaveClass(on ? /rb-toggle-switch-checked/ : /rb-toggle-switch(?!-checked)/, { timeout });
  }

  // ── Security (2-step verification) ─────────────────────────────────────────

  twoStepStatus(): Locator {
    return this.page.getByRole('heading', { name: /^(ON|OFF)$/, level: 4 }).first();
  }

  /** Returns 'ON' | 'OFF' once the preference has loaded (skeleton gone). */
  async getTwoStepStatus(): Promise<'ON' | 'OFF'> {
    const turnOff = this.page.locator('#turn-off');
    const activate = this.page.locator('#activate');
    await turnOff.or(activate).first().waitFor({ state: 'visible', timeout: 30_000 });
    return (await turnOff.isVisible()) ? 'ON' : 'OFF';
  }

  /** SMS code dialog (2FAVerification.tsx auto-sends the code on /settings). */
  private async enterSmsCodeAndFinish(): Promise<void> {
    await this.page.locator('#code-1').waitFor({ state: 'visible', timeout: 30_000 });
    const otp = ENV.ENTER_OTP;
    for (let i = 0; i < otp.length; i++) {
      await this.page.locator(`#code-${i + 1}`).fill(otp[i]);
    }
    const verify = this.page.locator('#verify_code');
    await expect(verify).toBeEnabled({ timeout: 10_000 });
    await verify.click();
    const gotIt = this.page.locator('#got-it');
    await gotIt.waitFor({ state: 'visible', timeout: 30_000 });
    await gotIt.click();
  }

  async activateTwoStep(): Promise<void> {
    await this.page.locator('#activate').click();
    await this.enterSmsCodeAndFinish();
    await expect(this.page.locator('#turn-off')).toBeVisible({ timeout: 30_000 });
    await expect(this.twoStepStatus()).toHaveText('ON');
  }

  async deactivateTwoStep(): Promise<void> {
    await this.page.locator('#turn-off').click();
    const dialog = this.page.locator('#turn-off-dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText(/turn off two-step login/i)).toBeVisible();
    await dialog.locator('#dialog-button-primaryAction').click(); // "Yes"
    await this.enterSmsCodeAndFinish();
    await expect(this.page.locator('#activate')).toBeVisible({ timeout: 30_000 });
    await expect(this.twoStepStatus()).toHaveText('OFF');
  }

  // ── Notifications ───────────────────────────────────────────────────────────

  allowNotificationsToggle(): Locator {
    return this.page.locator('#toggle-allow-notifications:visible').first();
  }

  notificationToggle(prefKey: string): Locator {
    return this.page.locator(`#toggle-${prefKey}:visible`).first();
  }

  async ensureNotificationsAllowed(): Promise<void> {
    const master = this.allowNotificationsToggle();
    await master.waitFor({ state: 'visible', timeout: 30_000 });
    if (!(await SettingsFlow.isToggleOn(master))) {
      await master.click();
      await this.expectToggle(master, true);
    }
  }

  // ── Payment preferences ─────────────────────────────────────────────────────

  preferredBankCard(): Locator {
    return this.page.locator('[class*="rb-preferred-bank-card"]:not([class*="skeleton"])').first();
  }

  /**
   * Current preferred bank logo src, or null when none is set (#connect-bank shown).
   * The card shows bank_name ("Bank of Montreal") but the list shows the icon title ("BMO bank"),
   * so banks are matched by logo (both use the same fetchIcon/fetchBankIcon src).
   */
  async getPreferredBank(): Promise<string | null> {
    const change = this.page.locator('#change-bank');
    const connect = this.page.locator('#connect-bank');
    await change.or(connect).first().waitFor({ state: 'visible', timeout: 30_000 });
    if (await connect.isVisible()) return null;
    return this.preferredBankCard().locator('img').first().getAttribute('src');
  }

  async openPreferredBankDialog(): Promise<Locator> {
    await this.page.locator('#change-bank, #connect-bank').first().click();
    const dialog = this.page.locator('#preferred-bank-dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(this.bankItems(dialog).first()).toBeVisible({ timeout: 20_000 });
    return dialog;
  }

  private bankItems(dialog: Locator): Locator {
    // BankListItem root is the clickable row; the name wrapper's parent is exactly that row.
    return dialog.locator('[class*="rb-bankName-wrapper"]').locator('xpath=..');
  }

  /**
   * Pick a bank in the dialog — the one with logo `src`, or else the first one whose logo isn't
   * `excludeSrc` (skipping "Other bank"). Waits for the card to show it. Returns the chosen logo src.
   */
  async choosePreferredBank(opts: { src?: string; excludeSrc?: string | null }): Promise<string> {
    const dialog = await this.openPreferredBankDialog();
    const items = this.bankItems(dialog);
    const count = await items.count();
    let target: Locator | null = null;
    let targetSrc = '';
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const name = (await item.innerText()).trim();
      const src = (await item.locator('img').first().getAttribute('src').catch(() => null)) ?? '';
      if (!src || /^other bank/i.test(name)) continue;
      if (opts.src ? src === opts.src : src !== opts.excludeSrc) { target = item; targetSrc = src; break; }
    }
    if (!target) throw new Error('No matching bank in the preferred-bank list');
    await target.click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(this.preferredBankCard().locator('img').first()).toHaveAttribute('src', targetSrc, { timeout: 30_000 });
    return targetSrc;
  }

  // ── Change password ─────────────────────────────────────────────────────────

  async fillChangePassword(current: string, next: string, confirm = next): Promise<void> {
    await this.page.locator('#current_password').fill(current);
    await this.page.locator('#new_password').fill(next);
    await this.page.locator('#confirm_new_password').fill(confirm);
  }

  async clickUpdatePassword(): Promise<void> {
    await this.page.locator('#save:visible').first().click();
  }

  // ── Rates subscriptions ─────────────────────────────────────────────────────

  /** Rates toggles have no id — find the row ("Email notifications" / "Push notifications"). */
  ratesToggle(label: 'Email notifications' | 'Push notifications'): Locator {
    return this.page.locator('[class*="rb-toggle-box"]:visible')
      .filter({ hasText: label }).first()
      .locator('[class*="rb-toggle-switch"]').first();
  }

  // ── Backwards-compatible helpers used by older specs ────────────────────────

  async clickSave(): Promise<void> {
    await this.page.locator('#save-changes:visible, #save:visible').first().click();
  }

  async toggleNotification(prefKey: string): Promise<void> {
    await this.notificationToggle(prefKey).click();
  }

  async assertTurnOffDialog(): Promise<void> {
    await expect(this.page.locator('#turn-off-dialog').first()).toBeVisible({ timeout: 10_000 });
  }

  async changePassword(currentPwd: string, newPwd: string): Promise<void> {
    await this.fillChangePassword(currentPwd, newPwd);
    await this.clickUpdatePassword();
  }
}
