import { Page, Locator, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

/**
 * Schedule transfer wizard (/schedule-transaction). Selectors from remitbee-cp source
 * (src/components/scheduleTransaction/**) + Jam db231923 (2026-10-01):
 *
 *  recipient  /schedule-transaction/recipient/select-recipient — "Select your recipient", search box,
 *             rows = RecipientList items (title Typography id="recipient-id-<name>")
 *  transfer   /schedule-transaction/transfer — #send-money-transfer-details, #send-money-coverter-box,
 *             #sendingEnd, #continue (first click often swallowed while rates load → retry)
 *  scheduling /schedule-transaction/scheduling/frequency — #send-money-select-method (title),
 *             DatePicker #scheduling-date → calendar #calendar-dropdown (#next-month-btn, day buttons
 *             [class*="rb-dayBtn"], disabled ones carry rb-disabled); after a date: "Repeat" DropDown
 *             (Never / Weekly / Bi-weekly / Monthly / Quarterly); non-Never adds "Stop repeating on"
 *             DatePicker #date-picker-input; #set-schedule-button, #send-now-instead-button,
 *             #date-warning-alert, #monthly-limit-exceeded-alert
 *  purpose    /schedule-transaction/scheduling/purpose — button[id$="-purpose-selection"], li[data-item],
 *             #purpose-selection-continue
 *  payment    /schedule-transaction/payment — #payment-title, #scheduling-balance, #balance-alert,
 *             #select-pay-type-continue
 *  overview   /schedule-transaction/overview — #overview, #transfer-summary, #recipient-summary,
 *             #payment-summary, #create-scheduled-transaction ("Confirm and send")
 *  success    → /dashboard with Dialog #scheduled-transfer-dialog ("Got it")
 */
export class ScheduleFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  private path(): string {
    return new URL(this.page.url()).pathname;
  }

  recipientHeading(): Locator {
    return this.page.getByRole('heading', { name: /select your recipient/i });
  }

  recipientRows(): Locator {
    // Title typography of each recipient row; skip rows whose country is unavailable
    return this.page.locator('[id^="recipient-id-"]:visible')
      .filter({ hasNotText: /account$|unavailable/i });
  }

  async navigateToSchedule(): Promise<void> {
    await this.navigateSidebar('Schedule');
    await this.page.waitForURL(/schedule-transaction/i, { timeout: 20_000 });
    await this.dismissAllOverlays();
    // First-time schedulers get a splash (pages/schedule-transaction/index.tsx):
    // "Schedule Money Transfers" → "Let's get started" (no id) → wizard
    const start = this.page.getByRole('button', { name: /let's get started/i });
    const inWizard = this.page.locator('[id^="recipient-id-"], #send-money-transfer-details')
      .or(this.recipientHeading()).first();
    await start.or(inWizard).first().waitFor({ state: 'visible', timeout: 45_000 }).catch(() => {});
    if (await start.isVisible().catch(() => false)) {
      await start.click();
      await this.page.waitForURL(/schedule-transaction\/.+/, { timeout: 30_000 });
    }
  }

  async assertScheduleListVisible(): Promise<void> {
    await this.page.waitForURL(/schedule-transaction\/recipient/, { timeout: 30_000 });
    await expect(this.recipientHeading()).toBeVisible({ timeout: 45_000 });
  }

  /** Kept for older callers — the wizard opens directly on recipient selection now. */
  async clickCreateSchedule(): Promise<void> {
    await this.assertScheduleListVisible();
  }

  // ── Recipient ───────────────────────────────────────────────────────────────

  async selectFirstRecipient(): Promise<string> {
    await this.assertScheduleListVisible();
    const row = this.recipientRows().first();
    await expect(row).toBeVisible({ timeout: 45_000 });
    const name = (await row.innerText()).trim();
    await expect(async () => {
      if (!/schedule-transaction\/recipient/.test(this.path())) return;
      await row.click({ timeout: 5_000 });
      await this.page.waitForURL(/schedule-transaction\/transfer/, { timeout: 10_000 });
    }).toPass({ timeout: 40_000, intervals: [1_000, 2_000] });
    return name;
  }

  async selectScheduleRecipient(name: string): Promise<void> {
    await this.assertScheduleListVisible();
    await this.page.locator(`[id="recipient-id-${name}"]`).first().click();
    await this.page.waitForURL(/schedule-transaction\/transfer/, { timeout: 30_000 });
  }

  // ── Transfer details ────────────────────────────────────────────────────────

  async enterScheduleAmount(amount: string): Promise<void> {
    const input = this.page.locator('#send-money-coverter-box #sendingEnd');
    await input.waitFor({ state: 'visible', timeout: 30_000 });
    await input.click({ clickCount: 3 });
    await input.fill(amount);
    await this.page.locator('#send-money-coverter-box #loading').first()
      .waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  async continueFromTransfer(): Promise<void> {
    const btn = this.page.locator('#continue:visible').first();
    await expect(async () => {
      if (!/schedule-transaction\/transfer/.test(this.path())) return;
      await expect(btn).toBeEnabled({ timeout: 5_000 });
      await btn.click();
      await expect.poll(() => this.path(), { timeout: 8_000 }).toMatch(/scheduling/);
    }).toPass({ timeout: 45_000, intervals: [1_000, 2_000, 3_000] });
  }

  /** Recipient → transfer details (amount entered). */
  async goToTransfer(amount = '20'): Promise<void> {
    await this.selectFirstRecipient();
    await expect(this.page.locator('#send-money-transfer-details')).toBeVisible({ timeout: 30_000 });
    await this.enterScheduleAmount(amount);
  }

  /** … → scheduling (frequency) step. */
  async goToScheduling(amount = '20'): Promise<void> {
    await this.goToTransfer(amount);
    await this.continueFromTransfer();
    await expect(this.page.locator('#send-money-select-method')).toBeVisible({ timeout: 30_000 });
  }

  // ── Scheduling ──────────────────────────────────────────────────────────────

  private calendar(): Locator {
    return this.page.locator('#calendar-dropdown:visible, #calendar-dialog-modal:visible').first();
  }

  /** Pick day `day` of next month in the currently open calendar. */
  private async pickDayNextMonth(day = 15): Promise<void> {
    const cal = this.calendar();
    await expect(cal).toBeVisible({ timeout: 10_000 });
    await cal.locator('#next-month-btn').click();
    await cal.locator('[class*="rb-dayBtn"]:not([class*="rb-disabled"])')
      .filter({ hasText: new RegExp(`^\\s*${day}\\s*$`) }).first().click();
    await expect(cal).toBeHidden({ timeout: 10_000 }).catch(() => {});
  }

  /** Jam: click #scheduling-date → pick a day → input shows e.g. "Nov 15, 2026". */
  async setStartDateNextMonth(day = 15): Promise<void> {
    const input = this.page.locator('input#scheduling-date');
    await input.click();
    await this.pickDayNextMonth(day);
    await expect(input).not.toHaveValue('', { timeout: 10_000 });
  }

  /** Legacy signature: any date string → picks next month's 15th (the picker is not typeable). */
  async setStartDate(_date: string): Promise<void> {
    await this.setStartDateNextMonth(15);
  }

  frequencyField(): Locator {
    return this.page.locator('button[id^="dropdown-"]:visible').first();
  }

  frequencyOption(name: 'Never' | 'Weekly' | 'Bi-weekly' | 'Monthly' | 'Quarterly'): Locator {
    return this.page.locator('li:visible').filter({ hasText: new RegExp(`^\\s*${name}`, 'i') }).first();
  }

  async openFrequency(): Promise<void> {
    const field = this.frequencyField();
    await expect(field).toBeVisible({ timeout: 15_000 });
    if (!(await this.frequencyOption('Never').isVisible().catch(() => false))) await field.click();
    await expect(this.frequencyOption('Never')).toBeVisible({ timeout: 10_000 });
  }

  async selectFrequency(name: 'Never' | 'Weekly' | 'Bi-weekly' | 'Monthly' | 'Quarterly'): Promise<void> {
    await expect(async () => {
      await this.openFrequency();
      await this.frequencyOption(name).click({ timeout: 5_000 });
      await expect(this.frequencyField()).toContainText(new RegExp(`^\\s*${name}`, 'i'), { timeout: 3_000 });
    }).toPass({ timeout: 25_000, intervals: [500, 1_000] });
  }

  /** "Stop repeating on" date (shown for any frequency other than Never). */
  async setStopDate(monthsAhead = 3, day = 15): Promise<void> {
    const input = this.page.locator('input#date-picker-input:visible').first();
    await input.click();
    const cal = this.calendar();
    await expect(cal).toBeVisible({ timeout: 10_000 });
    for (let i = 0; i < monthsAhead; i++) await cal.locator('#next-month-btn').click();
    await cal.locator('[class*="rb-dayBtn"]:not([class*="rb-disabled"])')
      .filter({ hasText: new RegExp(`^\\s*${day}\\s*$`) }).first().click();
    await expect(input).not.toHaveValue('', { timeout: 10_000 });
  }

  async clickScheduleConfirm(): Promise<void> {
    await this.page.locator('#set-schedule-button').click();
  }

  async clickSendNowInstead(): Promise<void> {
    await this.page.locator('#send-now-instead-button').click();
  }

  /** … → purpose → payment step. One-time schedule next month. */
  async goToPayment(amount = '20'): Promise<void> {
    await this.goToScheduling(amount);
    await this.setStartDateNextMonth(15);
    await this.selectFrequency('Never');
    await this.clickScheduleConfirm();
    const purpose = this.page.locator('#purpose-selection');
    const payTitle = this.page.locator('#payment-title');
    await purpose.or(payTitle).first().waitFor({ state: 'visible', timeout: 30_000 });
    if (await purpose.isVisible().catch(() => false)) {
      await this.selectFirstPurpose();
      await this.page.locator('#purpose-selection-continue').click();
    }
    await expect(payTitle).toBeVisible({ timeout: 30_000 });
  }

  async selectFirstPurpose(): Promise<void> {
    // PurposeDropDown.tsx: id={`${flow}-purpose-selection`} — flow differs per wizard, so match the suffix
    const field = this.page.locator('button[id$="-purpose-selection"]:visible').first();
    await field.waitFor({ state: 'visible', timeout: 20_000 });
    if (!(await field.getByText(/select purpose/i).isVisible().catch(() => false))) return;
    await expect(async () => {
      const item = this.page.locator('li[data-item]:visible').first();
      if (!(await item.isVisible().catch(() => false))) await field.click();
      await item.click({ timeout: 5_000 });
      await expect(field.getByText(/select purpose/i)).toBeHidden({ timeout: 3_000 });
    }).toPass({ timeout: 20_000, intervals: [500, 1_000, 2_000] });
  }

  /** … → overview. */
  async goToOverview(amount = '20'): Promise<void> {
    await this.goToPayment(amount);
    const cont = this.page.locator('#select-pay-type-continue');
    await expect(cont).toBeEnabled({ timeout: 20_000 });
    await cont.click();
    await expect(this.page.locator('#overview')).toBeVisible({ timeout: 30_000 });
  }

  async assertScheduleCreated(): Promise<void> {
    const dialog = this.page.locator('#scheduled-transfer-dialog');
    await expect(dialog).toBeVisible({ timeout: 45_000 });
  }
}
