import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

export class DashboardFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  async assertDashboardLoaded(): Promise<void> {
    await this.page.waitForURL(/\/(dashboard|home)/i, { timeout: 30_000 });
    await this.dismissAllOverlays();
    // CP renders id="dashboard-your-balance" or id="dashboard-quick-actions" on load
    const dashboard = this.page
      .locator('#dashboard-your-balance, #dashboard-quick-actions, [class*="dashboard"], main')
      .first();
    await dashboard.waitFor({ state: 'visible' });
  }

  async assertBalanceVisible(): Promise<void> {
    // CP uses id="dashboard-your-balance" for the balance widget
    const balance = this.page.locator('#dashboard-your-balance').first();
    await balance.waitFor({ state: 'visible' });
    await expect(balance).toBeVisible();
  }

  async assertSidebarVisible(): Promise<void> {
    const sidebar = this.page.locator('nav, [class*="sidebar"], [class*="Sidebar"]').first();
    await sidebar.waitFor({ state: 'visible' });
    await expect(sidebar).toBeVisible();
  }

  async assertQuickActionsSendMoney(): Promise<void> {
    // CP uses id="dashboard-quick-actions" for the quick-actions section
    const quickActions = this.page.locator('#dashboard-quick-actions').first();
    await quickActions.waitFor({ state: 'visible' });
    await expect(quickActions).toBeVisible();
  }

  async assertRecentTransactions(): Promise<void> {
    // CP uses id="dashboard-latest-transactions" for the recent-transactions widget
    const txSection = this.page.locator('#dashboard-latest-transactions').first();
    await txSection.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(txSection).toBeVisible();
  }

  async assertRatesWidget(): Promise<void> {
    // CP uses id="dashboard-benefits" for benefits/rates widget (fallback to class)
    const rates = this.page
      .locator('#dashboard-benefits, [class*="rate"], [class*="exchange"]')
      .first();
    await rates.waitFor({ state: 'visible', timeout: 15_000 });
  }

  async assertNotificationsIcon(): Promise<void> {
    const bell = this.page
      .locator('[aria-label*="notification" i], [class*="notification"]')
      .first();
    await bell.waitFor({ state: 'visible' });
    await expect(bell).toBeVisible();
  }

  async clickSendMoneyQuickAction(): Promise<void> {
    // Click inside quick-actions section, the Send button
    const quickActions = this.page.locator('#dashboard-quick-actions');
    const sendBtn = quickActions
      .locator('a, button')
      .filter({ hasText: /send/i })
      .first();
    await sendBtn.click({ force: true });
  }

  async clickViewAllTransactions(): Promise<void> {
    // CP uses id="dashboard-transactions-view-all" for the View All link
    await this.page.locator('#dashboard-transactions-view-all').first().click();
  }

  async assertAccountSwitcher(): Promise<void> {
    const switcher = this.page
      .locator('[class*="account"], [class*="Account"]')
      .filter({ hasText: /personal|business/i })
      .first();
    await switcher.waitFor({ state: 'visible' });
    await expect(switcher).toBeVisible();
  }
}
