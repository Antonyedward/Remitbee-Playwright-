import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

export class EscalationFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  async navigateToEscalation(): Promise<void> {
    // Escalations live at /resolution-centre (not a /escalation route)
    await this.navigateSidebar('Escalation');  // resolves to /resolution-centre
    await this.page.waitForURL(/resolution-centre|escalat/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
  }

  async clickRaiseIssue(): Promise<void> {
    // CP uses id="create-escalation" in Inbox splash; fallback to text-based matching
    const btn = this.page
      .locator('#create-escalation, button:has-text("Raise"), button:has-text("Report issue"), button:has-text("Contact us"), button:has-text("New escalation"), button:has-text("Get help")')
      .first();
    await btn.waitFor({ state: 'visible', timeout: 10_000 });
    await btn.click({ force: true });
  }

  async selectIssueType(type: string): Promise<void> {
    const option = this.page
      .locator('[class*="issue-type"], [class*="IssueType"]')
      .filter({ hasText: new RegExp(type, 'i') })
      .first();
    await option.click({ force: true });
  }

  async fillIssueDescription(description: string): Promise<void> {
    // CP uses id="description" for the escalation description textarea
    const textarea = this.page.locator('#description, textarea').first();
    await textarea.fill(description);
  }

  async submitIssue(): Promise<void> {
    // CP uses id="create-escalation" for the Submit/Create escalation button
    const btn = this.page.locator('#create-escalation').first();
    const found = await btn.isVisible().catch(() => false);
    if (found) {
      await btn.click({ force: true });
    } else {
      await this.page
        .locator('button:has-text("Submit"), button:has-text("Send")')
        .first()
        .click({ force: true });
    }
  }

  async assertIssueSubmitted(): Promise<void> {
    // CP uses id="success-message" after issue creation
    const success = this.page
      .locator('#success-message, [class*="success"]')
      .or(this.page.getByText(/submitted|raised|ticket.*created/i))
      .first();
    await success.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(success).toBeVisible();
  }

  async closeEscalation(): Promise<void> {
    // CP uses id="close-escalation" to close/resolve an escalation
    await this.page.locator('#close-escalation').first().click({ force: true });
  }

  async assertCannotCloseDialog(): Promise<void> {
    // CP uses id="cannot-close-escalation" when closure is blocked
    await expect(this.page.locator('#cannot-close-escalation').first()).toBeVisible({ timeout: 10_000 });
  }

  async confirmFileUpload(): Promise<void> {
    // CP uses id="confirm-upload" for the file upload confirmation
    await this.page.locator('#confirm-upload').first().click({ force: true });
  }

  async assertMessageFormDialog(): Promise<void> {
    await expect(this.page.locator('#message-form-dialog').first()).toBeVisible({ timeout: 10_000 });
  }

  async assertEscalationList(): Promise<void> {
    const list = this.page.locator('[class*="escalation"], [class*="Escalation"]').first();
    await list.waitFor({ state: 'visible' });
    await expect(list).toBeVisible();
  }

  async assertTicketStatus(status: string): Promise<void> {
    const statusEl = this.page
      .locator('[class*="status"]')
      .filter({ hasText: new RegExp(status, 'i') })
      .first();
    await statusEl.waitFor({ state: 'visible' });
    await expect(statusEl).toBeVisible();
  }
}
