import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

export class ScheduleFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  async navigateToSchedule(): Promise<void> {
    await this.navigateSidebar('Schedule');
    await this.page.waitForURL(/schedule/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
  }

  async clickCreateSchedule(): Promise<void> {
    await this.page
      .locator('button:has-text("Create"), button:has-text("New schedule"), button:has-text("Schedule transfer")')
      .first()
      .click();
  }

  async selectFrequency(frequency: string): Promise<void> {
    const selector = this.page
      .locator('[class*="frequency"], select[name*="frequency"]')
      .or(this.page.locator('[class*="option"]').filter({ hasText: new RegExp(frequency, 'i') }))
      .first();
    await selector.click({ force: true });
    const option = this.page.getByText(frequency, { exact: false }).first();
    if (await option.isVisible().catch(() => false)) await option.click();
  }

  async setStartDate(date: string): Promise<void> {
    // CP uses id="scheduling-date" for the date picker
    const input = this.page.locator('#scheduling-date, input[type="date"]').first();
    await input.fill(date);
  }

  async enterScheduleAmount(amount: string): Promise<void> {
    const input = this.page.locator('input[name*="amount"], input[placeholder*="amount" i]').first();
    await input.fill(amount);
  }

  async selectScheduleRecipient(name: string): Promise<void> {
    const recipient = this.page
      .locator('[class*="recipient"]')
      .filter({ hasText: name })
      .first();
    await recipient.click({ force: true });
  }

  async clickScheduleConfirm(): Promise<void> {
    // CP uses id="set-schedule-button" to confirm creating a schedule
    const btn = this.page.locator('#set-schedule-button').first();
    const found = await btn.isVisible().catch(() => false);
    if (found) {
      await btn.click({ force: true });
    } else {
      await this.page
        .locator('#select-pay-type-continue, button:has-text("Confirm"), button:has-text("Schedule")')
        .first()
        .click({ force: true });
    }
  }

  async clickSendNowInstead(): Promise<void> {
    // CP uses id="send-now-instead-button" to skip scheduling
    await this.page.locator('#send-now-instead-button').first().click({ force: true });
  }

  async assertScheduleCreated(): Promise<void> {
    // CP shows id="scheduled-transfer-dialog" on success
    const success = this.page
      .locator('#scheduled-transfer-dialog')
      .or(this.page.getByText(/scheduled|created|success/i))
      .first();
    await success.waitFor({ state: 'visible', timeout: 20_000 });
  }

  async assertScheduleListVisible(): Promise<void> {
    // No explicit list container ID in CP scheduleTransaction/ source; use class-based selector
    const list = this.page
      .locator('[class*="schedule"], [class*="Schedule"]')
      .first();
    await list.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(list).toBeVisible();
  }

  async pauseSchedule(index: number = 0): Promise<void> {
    const item = this.page.locator('[class*="schedule-item"], [class*="ScheduleItem"]').nth(index);
    const pauseBtn = item.locator('button:has-text("Pause"), button[aria-label*="pause" i]').first();
    await pauseBtn.click({ force: true });
  }

  async deleteSchedule(index: number = 0): Promise<void> {
    const item = this.page.locator('[class*="schedule-item"], [class*="ScheduleItem"]').nth(index);
    const deleteBtn = item.locator('button:has-text("Delete"), button[aria-label*="delete" i]').first();
    await deleteBtn.click({ force: true });
    const confirmBtn = this.page.locator('button:has-text("Confirm"), button:has-text("Yes")').first();
    await confirmBtn.click();
  }
}
