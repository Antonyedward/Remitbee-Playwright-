import { Page, Locator, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';
import { ENV } from '../../config/environments';

/**
 * Account details (/account-details) + account switcher in the top-bar user menu.
 * Live DOM / CP source (pages/account-details.js, settingsV2/AccountDetails, UserMenu.tsx):
 *  - Inputs: #cus_firstname, #cus_lastname, #cus_email, #cus_phone1, #cus_address1, #cus_address2 (unit),
 *    #cus_city, #cus_postal …; errors render as #<id>-error-text after Save (react-hook-form onSubmit).
 *  - Section "Edit" links all share id="edit" (0 personal, 1 contact, 2 address).
 *  - Save: #save-changes → #success-dialog ("Success!" / Got it). No diff → nothing happens.
 *  - Verified details → Edit opens #account-details-dialog-box ("Information cannot be edited").
 *  - Address Edit → #edit-address-dialog (Continue / Cancel).
 *  - Business accounts get tabs #business-details / #personal-details.
 *  - User menu: click #fullname → items [id^="user-menu-"]; switch item text is
 *    "Switch to business|personal account" (has both) or "Open a business|personal account".
 */
export class AccountFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  // ── Account details page ───────────────────────────────────────────────────

  async navigateToAccount(): Promise<void> {
    await this.page.goto(ENV.BASE_URL + '/account-details', { waitUntil: 'domcontentloaded' });
    await this.page.waitForURL(/account-details/i, { timeout: 30_000 });
    await this.dismissAllOverlays();
    await expect(this.page.getByRole('heading', { name: /account details/i })).toBeVisible({ timeout: 30_000 });
    await expect(this.saveButton()).toBeVisible({ timeout: 30_000 });
  }

  input(id: string): Locator {
    return this.page.locator(`input#${id}:visible`).first();
  }

  errorText(id: string): Locator {
    return this.page.locator(`#${id}-error-text:visible`).first();
  }

  saveButton(): Locator {
    return this.page.locator('#save-changes:visible').first();
  }

  editLink(index: 0 | 1 | 2): Locator {
    return this.page.locator('#edit:visible').nth(index);
  }

  async saveChanges(): Promise<void> {
    await expect(this.saveButton()).toBeEnabled({ timeout: 15_000 });
    await this.saveButton().click();
  }

  successDialog(): Locator {
    return this.page.locator('#success-dialog');
  }

  async assertSaveSuccess(): Promise<void> {
    await expect(this.successDialog()).toBeVisible({ timeout: 20_000 });
    await expect(this.successDialog()).toContainText(/success/i);
    await this.successDialog().locator('#dialog-button-primaryAction').click();
    await expect(this.successDialog()).toBeHidden({ timeout: 10_000 });
  }

  cannotEditDialog(): Locator {
    return this.page.locator('#account-details-dialog-box');
  }

  async closeDialog(dialog: Locator): Promise<void> {
    const close = dialog.locator('#close-dialog').first();
    if (await close.isVisible().catch(() => false)) await close.click();
    else await this.page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  }

  // Business account tabs
  businessTab(): Locator {
    return this.page.locator('#business-details:visible').first();
  }

  personalTab(): Locator {
    return this.page.locator('#personal-details:visible').first();
  }

  // ── User menu / account switching ──────────────────────────────────────────

  async openUserMenu(): Promise<void> {
    const items = this.page.locator('[id^="user-menu-"]:not(#user-menu-dropdown):visible');
    await expect(async () => {
      if (!(await items.first().isVisible().catch(() => false))) {
        await this.page.locator('#fullname').first().click();
      }
      await expect(items.first()).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
  }

  switchMenuItem(): Locator {
    return this.page.locator('[id^="user-menu-"]:not(#user-menu-dropdown):visible').filter({ hasText: /switch to|open a/i }).first();
  }

  async getSwitchLabel(): Promise<string> {
    await this.openUserMenu();
    await expect(this.switchMenuItem()).toBeVisible({ timeout: 15_000 });
    return (await this.switchMenuItem().innerText()).trim();
  }

  /** Switch the active account. Only valid when the customer has both accounts. */
  async switchAccount(type: 'Business' | 'Personal'): Promise<void> {
    await this.openUserMenu();
    const item = this.page.locator('[id^="user-menu-"]:not(#user-menu-dropdown):visible')
      .filter({ hasText: new RegExp(`switch to ${type} account`, 'i') }).first();
    await expect(item).toBeVisible({ timeout: 15_000 });
    await item.click();
    if (type === 'Business') {
      await this.page.waitForURL(/business-account\/dashboard/, { timeout: 45_000 });
    } else {
      await this.page.waitForURL(url => /\/dashboard/.test(url.pathname) && !/business-account/.test(url.pathname),
        { timeout: 45_000 });
    }
    await this.dismissAllOverlays();
  }

  isBusinessActive(): boolean {
    return /business-account/.test(this.page.url());
  }
}
