import { Page, Locator, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';
import { ENV } from '../../config/environments';

/**
 * Resolution centre (/resolution-centre) + escalation wizard (/escalation/<step>).
 * Live DOM / CP source (inbox-v2, escalation-v2):
 *  - List page: heading "Resolution centre", "All escalations (n)", search input#search-transactions,
 *    "Create escalation" button (id="download" on the list, id="create-escation" on the empty state).
 *    Rows: table rows with Subject / Case ID / Last updated / Status; status chip #status-open etc.
 *  - Step 1 /escalation/issue-type: DropDowns button#issueTypeSelected + button#issueSubTypeSelected
 *    (options li[data-item]); Continue = #save-changes (never disabled — validates on submit).
 *  - Transaction type → /escalation/select-transaction; others → /escalation/add-details.
 *  - Step add-details: textarea#description, file input[type=file], Create = #create-escalation;
 *    empty message → #error "message required".
 *  - Success → /resolution-centre with #escalation-success ("Escalation was created", #escalation-id).
 *  - Detail /resolution-centre/escalation/<id>: link "Close escalation" → dialog #close-escalation
 *    (primary = Close escalation) → back to list; ES007 → #cannot-close-escalation.
 */
export class EscalationFlow extends FlowBase {
  static readonly ISSUE_TYPES = ['Transaction', 'Compliance', 'Onboarding', 'Technical', 'General'];

  constructor(page: Page) {
    super(page);
  }

  // ── List page ──────────────────────────────────────────────────────────────

  async navigateToEscalation(): Promise<void> {
    await this.page.goto(ENV.BASE_URL + '/resolution-centre', { waitUntil: 'domcontentloaded' });
    await this.page.waitForURL(/resolution-centre/i, { timeout: 30_000 });
    await this.dismissAllOverlays();
    await expect(this.page.getByRole('heading', { name: /resolution centre/i }).first()).toBeVisible({ timeout: 30_000 });
    await expect(this.createButton().or(this.emptyStateHeading()).first()).toBeVisible({ timeout: 30_000 });
  }

  createButton(): Locator {
    return this.page.locator('#download:visible, #create-escation:visible')
      .or(this.page.getByRole('button', { name: /create escalation/i })).first();
  }

  emptyStateHeading(): Locator {
    return this.page.getByRole('heading', { name: /don.t have any escalations/i });
  }

  searchInput(): Locator {
    return this.page.locator('input#search-transactions:visible').first();
  }

  rows(): Locator {
    return this.page.locator('table tbody tr:visible');
  }

  rowFor(id: string): Locator {
    return this.rows().filter({ has: this.page.getByRole('cell', { name: id, exact: true }) }).first();
  }

  async search(text: string): Promise<void> {
    await this.searchInput().fill(text);
    await this.searchInput().press('Enter');
    await this.page.waitForTimeout(1_500);
  }

  // ── Wizard step 1 — issue type ─────────────────────────────────────────────

  async clickRaiseIssue(): Promise<void> {
    await expect(async () => {
      if (!/escalation\/issue-type/.test(this.page.url())) await this.createButton().click();
      await this.page.waitForURL(/escalation\/issue-type/, { timeout: 8_000 });
    }).toPass({ timeout: 40_000 });
    await expect(this.issueTypeDropdown()).toBeVisible({ timeout: 30_000 });
  }

  issueTypeDropdown(): Locator {
    return this.page.locator('button#issueTypeSelected:visible').first();
  }

  subTypeDropdown(): Locator {
    // Disabled state renders as a textbox "Select problem"; enabled as a dropdown button
    return this.page.locator('button#issueSubTypeSelected:visible, input#issueSubTypeSelected:visible')
      .or(this.page.getByRole('textbox', { name: /select problem/i })).first();
  }

  dropdownOptions(): Locator {
    return this.page.locator('li[data-item]:visible');
  }

  async openIssueTypes(): Promise<string[]> {
    await this.issueTypeDropdown().click();
    await expect(this.dropdownOptions().first()).toBeVisible({ timeout: 10_000 });
    return (await this.dropdownOptions().allInnerTexts()).map(s => s.trim()).filter(Boolean);
  }

  async selectIssueType(type: string): Promise<void> {
    const option = this.dropdownOptions().filter({ hasText: new RegExp(`^\\s*${type}\\s*$`, 'i') }).first();
    await expect(async () => {
      if (!(await option.isVisible().catch(() => false))) await this.issueTypeDropdown().click();
      await expect(option).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 30_000 });
    await option.click();
    await expect(this.issueTypeDropdown()).toContainText(new RegExp(type, 'i'));
  }

  /** Pick a problem (sub-type). Defaults to the first option. Returns the chosen text. */
  async selectProblem(text?: string): Promise<string> {
    await expect(this.subTypeDropdown()).toBeEnabled({ timeout: 10_000 });
    await this.subTypeDropdown().click();
    await expect(this.dropdownOptions().first()).toBeVisible({ timeout: 10_000 });
    const option = text
      ? this.dropdownOptions().filter({ hasText: text }).first()
      : this.dropdownOptions().first();
    const chosen = (await option.innerText()).trim();
    await option.click();
    return chosen;
  }

  async clickContinue(): Promise<void> {
    await this.page.locator('#save-changes:visible').first().click();
  }

  // ── Wizard step 3 — add details ────────────────────────────────────────────

  async goToAddDetails(type = 'General'): Promise<void> {
    await this.selectIssueType(type);
    await this.selectProblem();
    await this.clickContinue();
    await this.page.waitForURL(/escalation\/add-details/, { timeout: 30_000 });
    await expect(this.descriptionBox()).toBeVisible({ timeout: 20_000 });
  }

  descriptionBox(): Locator {
    return this.page.locator('textarea#description:visible').first();
  }

  async fillIssueDescription(description: string): Promise<void> {
    await this.descriptionBox().fill(description);
  }

  /**
   * "Attach file" opens an upload dialog (FileUploadV2 dropzone + "Confirm upload(s)").
   * The file only joins the escalation after Confirm.
   */
  async attachFile(filePath: string): Promise<void> {
    await this.page.getByRole('button', { name: /attach file/i }).first().click();
    const chooseFile = this.page.locator('#choose-file:visible').first();
    await expect(chooseFile).toBeVisible({ timeout: 10_000 });
    // innermost block holding both the dropzone button and its file input
    const zone = this.page.locator('div')
      .filter({ has: this.page.locator('#choose-file') })
      .filter({ has: this.page.locator('input[type="file"]') }).last();
    await zone.locator('input[type="file"]').first().setInputFiles(filePath);
    const name = filePath.split(/[\\/]/).pop()!;
    await expect(this.page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
    await this.page.getByRole('button', { name: /confirm upload/i }).first().click();
    await expect(chooseFile).toBeHidden({ timeout: 10_000 });
    await expect(this.page.getByText(/attachments/i).first()).toBeVisible({ timeout: 10_000 });
  }

  async submitIssue(): Promise<void> {
    const btn = this.page.locator('#create-escalation:visible').first();
    await expect(btn).toBeEnabled({ timeout: 15_000 });
    await btn.click();
  }

  /** Waits for the "Escalation was created" dialog, returns the new escalation id and closes the dialog. */
  async assertIssueSubmitted(): Promise<string> {
    await this.page.waitForURL(/resolution-centre/, { timeout: 45_000 });
    await expect(this.page.getByRole('heading', { name: /escalation was created/i })).toBeVisible({ timeout: 30_000 });
    const id = (await this.page.locator('#escalation-id').first().innerText()).trim();
    // "Got it" renders outside the #escalation-success node
    await this.page.getByRole('button', { name: /^got it$/i }).first().click();
    await expect(this.page.getByRole('heading', { name: /escalation was created/i })).toBeHidden({ timeout: 10_000 });
    return id;
  }

  /** Full happy path from the list page. Returns the new escalation id. */
  async createEscalation(message: string, filePath?: string): Promise<string> {
    await this.clickRaiseIssue();
    await this.goToAddDetails('General');
    await this.fillIssueDescription(message);
    if (filePath) await this.attachFile(filePath);
    await this.submitIssue();
    return this.assertIssueSubmitted();
  }

  // ── Detail page / close ────────────────────────────────────────────────────

  async openEscalation(id: string): Promise<void> {
    await this.page.goto(`${ENV.BASE_URL}/resolution-centre/escalation/${id}`, { waitUntil: 'domcontentloaded' });
    await this.page.waitForURL(new RegExp(`resolution-centre/escalation/${id}`), { timeout: 30_000 });
    await this.dismissAllOverlays();
  }

  async closeEscalation(): Promise<'closed' | 'cannot-close'> {
    await this.page.getByText(/^close escalation$/i).first().click();
    // Dialog action buttons render outside the #close-escalation node — go by heading + role
    await expect(this.page.getByRole('heading', { name: /close this escalation\?/i })).toBeVisible({ timeout: 10_000 });
    await this.page.getByRole('button', { name: /^close escalation$/i }).last().click();
    const cannot = this.page.getByRole('heading', { name: /need to keep this escalation open/i });
    await expect(async () => {
      const onList = /\/resolution-centre\/?(\?|$)/.test(this.page.url());
      const blocked = await cannot.isVisible().catch(() => false);
      expect(onList || blocked).toBe(true);
    }).toPass({ timeout: 30_000 });
    return (await cannot.isVisible().catch(() => false)) ? 'cannot-close' : 'closed';
  }
}
