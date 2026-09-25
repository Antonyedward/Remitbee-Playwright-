import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

export class SettingsFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  async navigateToSettings(): Promise<void> {
    await this.navigateSidebar('Settings');
    await this.page.waitForURL(/settings/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
  }

  // Settings tabs navigate via URL query params (?step=...) — direct nav is fastest and most reliable.
  // 'profile' maps to '' (empty) — the base /settings URL is the profile tab (no ?step= needed).
  private static readonly SETTINGS_STEPS: Record<string, string> = {
    'profile':               '',
    'security':              'security',
    'notifications':         'notifications',
    'payment':               'payment-preferences',
    'payment preferences':   'payment-preferences',
    'change password':       'change-password',
    'password':              'change-password',
    'rates':                 'rates-subscriptions',
    'rates subscriptions':   'rates-subscriptions',
    'delete':                'delete-account',
    'delete account':        'delete-account',
  };

  async clickTab(tabName: string): Promise<void> {
    const key = tabName.toLowerCase().trim();
    const step = SettingsFlow.SETTINGS_STEPS[key];

    // Key exists in map (even if step value is empty string for 'profile')
    if (key in SettingsFlow.SETTINGS_STEPS) {
      const baseUrl = this.page.url().split('?')[0].replace(/\/settings.*/, '');
      await this.page.goto(`${baseUrl}/settings${step ? `?step=${step}` : ''}`);
      // Small wait for React to re-render the tab content
      await this.page.waitForTimeout(500);
      return;
    }

    // Fallback: CP uses id="menu-item-${translated_label}" — try exact English label
    const byId = this.page.locator(`#menu-item-${tabName}`).first();
    const idVisible = await byId.isVisible().catch(() => false);
    if (idVisible) {
      await byId.click();
      return;
    }

    // Last resort: text match
    const tab = this.page
      .locator('[id^="menu-item-"], [role="tab"], [class*="tab"]')
      .filter({ hasText: new RegExp(tabName, 'i') })
      .first();
    await tab.waitFor({ state: 'visible', timeout: 10_000 });
    await tab.click();
  }

  async assertTabActive(tabName: string): Promise<void> {
    const tab = this.page
      .locator('[role="tab"][aria-selected="true"], [class*="tab--active"], [class*="activeTab"]')
      .filter({ hasText: new RegExp(tabName, 'i') })
      .first();
    await expect(tab).toBeVisible();
  }

  async updateProfileField(fieldName: string, value: string): Promise<void> {
    const input = this.page
      .locator(`input[name*="${fieldName}"], input[id*="${fieldName}"]`)
      .first();
    await input.waitFor({ state: 'visible' });
    await input.clear();
    await input.fill(value);
  }

  async clickSave(): Promise<void> {
    // CP Settings uses id="save-changes" for the Save/Update button, or id="save" in password form
    const btn = this.page.locator('#save-changes, #save').first();
    await btn.click({ force: true });
  }

  async assertSaveSuccess(): Promise<void> {
    // CP shows id="success-dialog" or id="bank-details-updated-dialog" on success
    const success = this.page
      .locator('#success-dialog, #bank-details-updated-dialog, #eft_added_success')
      .or(this.page.getByText(/saved|updated|success/i))
      .first();
    await success.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(success).toBeVisible();
  }

  async toggleNotification(label: string): Promise<void> {
    // CP uses id="toggle-allow-notifications" or id="toggle-${prefKey}" for notification toggles
    const prefKey = label.toLowerCase().replace(/\s+/g, '_');
    const byId = this.page.locator(`#toggle-${prefKey}, #toggle-allow-notifications`).first();
    const found = await byId.isVisible().catch(() => false);
    if (found) {
      await byId.click({ force: true });
      return;
    }
    const toggle = this.page
      .locator('[role="switch"], input[type="checkbox"], [class*="toggle"]')
      .filter({ has: this.page.locator(`label, span`, { hasText: new RegExp(label, 'i') }) })
      .first();
    await toggle.click({ force: true });
  }

  async assertTurnOffDialog(): Promise<void> {
    await expect(this.page.locator('#turn-off-dialog').first()).toBeVisible({ timeout: 10_000 });
  }

  async assertRemoveCardDialog(): Promise<void> {
    await expect(this.page.locator('#remove-card').first()).toBeVisible({ timeout: 10_000 });
  }

  async assertCurrentPassword(password: string): Promise<void> {
    const input = this.page.locator('input[name*="current"], input[placeholder*="current" i]').first();
    await input.fill(password);
  }

  async changePassword(currentPwd: string, newPwd: string): Promise<void> {
    await this.page.locator('input[name*="current"], input[placeholder*="current" i]').first().fill(currentPwd);
    await this.page.locator('input[name*="new"], input[placeholder*="new" i]').first().fill(newPwd);
    await this.page.locator('input[name*="confirm"], input[placeholder*="confirm" i]').first().fill(newPwd);
    await this.clickSave();
  }
}
