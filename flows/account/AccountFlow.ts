import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

export class AccountFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  async navigateToAccount(): Promise<void> {
    await this.navigateSidebar('Account');
    await this.page.waitForURL(/account/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
  }

  async assertAccountType(type: string): Promise<void> {
    const typeEl = this.page
      .locator('[class*="account-type"], [class*="AccountType"]')
      .or(this.page.getByText(new RegExp(type, 'i')))
      .first();
    await typeEl.waitFor({ state: 'visible' });
    await expect(typeEl).toBeVisible();
  }

  async switchAccount(type: 'Business' | 'Personal'): Promise<void> {
    // Open account switcher (usually in top bar or profile icon)
    const profileIcon = this.page
      .locator('[class*="profile"], [class*="avatar"], [class*="account-switcher"]')
      .first();
    const visible = await profileIcon.isVisible().catch(() => false);
    if (visible) {
      await profileIcon.click({ force: true });
    }
    const option = this.page
      .locator(`[class*="switch"], button, a`)
      .filter({ hasText: new RegExp(type, 'i') })
      .first();
    await option.waitFor({ state: 'visible', timeout: 10_000 });
    await option.click({ force: true });
    await this.page.waitForURL(/dashboard|home/i, { timeout: 15_000 });
  }

  async switchToBusinessAccount(): Promise<void> {
    await this.switchAccount('Business');
  }

  async switchToPersonalAccount(): Promise<void> {
    await this.switchAccount('Personal');
  }

  async assertAccountSummary(): Promise<void> {
    const summary = this.page.locator('[class*="account-summary"], [class*="AccountSummary"]').first();
    await summary.waitFor({ state: 'visible' });
    await expect(summary).toBeVisible();
  }

  async assertPersonalDetailsVisible(): Promise<void> {
    const details = this.page
      .locator('[class*="personal"], [class*="detail"], input')
      .first();
    await details.waitFor({ state: 'visible', timeout: 15_000 });
  }

  async fillPersonalDetails(
    firstName: string,
    lastName: string,
    address?: string,
    city?: string
  ): Promise<void> {
    const firstNameInput = this.page
      .locator('input[name*="first"], input[id*="first"], input[placeholder*="first" i]')
      .first();
    const isVisible = await firstNameInput.isVisible().catch(() => false);
    if (isVisible) {
      await firstNameInput.fill(firstName);
    }
    const lastNameInput = this.page
      .locator('input[name*="last"], input[id*="last"], input[placeholder*="last" i]')
      .first();
    const lastVisible = await lastNameInput.isVisible().catch(() => false);
    if (lastVisible) {
      await lastNameInput.fill(lastName);
    }
    if (address) {
      const addressInput = this.page
        .locator('input[name*="address"], input[id*="address"], input[placeholder*="address" i]')
        .first();
      const addrVisible = await addressInput.isVisible().catch(() => false);
      if (addrVisible) await addressInput.fill(address);
    }
    if (city) {
      const cityInput = this.page
        .locator('input[name*="city"], input[id*="city"], input[placeholder*="city" i]')
        .first();
      const cityVisible = await cityInput.isVisible().catch(() => false);
      if (cityVisible) await cityInput.fill(city);
    }
  }

  async clearPersonalDetails(): Promise<void> {
    const inputs = this.page.locator('input[type="text"]:not([readonly]):not([disabled])');
    const count = await inputs.count();
    for (let i = 0; i < Math.min(count, 3); i++) {
      await inputs.nth(i).fill('').catch(() => {});
    }
  }

  async saveChanges(): Promise<void> {
    const saveBtn = this.page.locator('#save-changes').first();
    const visible = await saveBtn.isVisible().catch(() => false);
    if (visible) {
      await saveBtn.click({ force: true });
    } else {
      await this.page
        .locator('button:has-text("Save"), button:has-text("Update")')
        .first()
        .click({ force: true });
    }
  }

  async assertSaveChangesButton(): Promise<void> {
    const saveBtn = this.page
      .locator('#save-changes, button:has-text("Save")')
      .first();
    await saveBtn.waitFor({ state: 'visible', timeout: 10_000 });
  }

  async assertSaveSuccess(): Promise<void> {
    const success = this.page
      .locator('#success-dialog, [class*="success"]')
      .or(this.page.getByText(/saved|updated|success/i))
      .first();
    await success.waitFor({ state: 'visible', timeout: 15_000 });
  }

  async clickTab(tabName: string): Promise<void> {
    const tab = this.page
      .locator('[id^="menu-item-"], [role="tab"], button, a')
      .filter({ hasText: new RegExp(tabName, 'i') })
      .first();
    await tab.waitFor({ state: 'visible', timeout: 10_000 });
    await tab.click({ force: true });
  }

  async closeAccount(): Promise<void> {
    const closeBtn = this.page.locator('button:has-text("Close account"), a:has-text("Close account")').first();
    await closeBtn.click({ force: true });
    const confirmBtn = this.page.locator('button:has-text("Confirm"), button:has-text("Yes, close")').first();
    await confirmBtn.waitFor({ state: 'visible' });
    await confirmBtn.click();
  }
}
