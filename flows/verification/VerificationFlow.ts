import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

export class VerificationFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  async navigateToVerification(): Promise<void> {
    await this.navigateSidebar('Verification');
    await this.page.waitForURL(/verif/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
  }

  async assertVerificationStatus(status: string): Promise<void> {
    const statusEl = this.page
      .locator('[class*="status"], [class*="Status"]')
      .filter({ hasText: new RegExp(status, 'i') })
      .first();
    await statusEl.waitFor({ state: 'visible' });
    await expect(statusEl).toBeVisible();
  }

  async clickStartVerification(): Promise<void> {
    // CP uses id="start-verification-btn" or id="increase-limits-btn" for the start CTA
    const btn = this.page
      .locator('#start-verification-btn, #increase-limits-btn')
      .first();
    const found = await btn.isVisible().catch(() => false);
    if (found) {
      await btn.click({ force: true });
    } else {
      await this.page
        .locator('button:has-text("Start"), button:has-text("Verify now")')
        .first()
        .click();
    }
  }

  async clickContinue(): Promise<void> {
    // CP uses id="continue" for step progression in verification wizard
    await this.page.locator('#continue').first().click({ force: true });
  }

  async clickRetry(): Promise<void> {
    await this.page.locator('#retry').first().click({ force: true });
  }

  async assertLevel4Dialog(): Promise<void> {
    await expect(this.page.locator('#level-4-dialog').first()).toBeVisible({ timeout: 10_000 });
  }

  async assertLimitResetDialog(): Promise<void> {
    await expect(this.page.locator('#limit-reset-dialog').first()).toBeVisible({ timeout: 10_000 });
  }

  async uploadDocument(docType: string, filePath: string): Promise<void> {
    const docBtn = this.page
      .locator('[class*="document"], [class*="Document"]')
      .filter({ hasText: new RegExp(docType, 'i') })
      .first();
    await docBtn.click({ force: true });

    const fileInput = this.page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(filePath);
  }

  async assertDocumentUploaded(): Promise<void> {
    const uploaded = this.page
      .locator('[class*="uploaded"], [class*="Uploaded"]')
      .or(this.page.getByText(/uploaded|submitted/i))
      .first();
    await uploaded.waitFor({ state: 'visible', timeout: 15_000 });
  }

  async selectDocumentType(type: string): Promise<void> {
    const typeBtn = this.page
      .locator('[class*="doc-type"], [class*="DocType"]')
      .filter({ hasText: new RegExp(type, 'i') })
      .or(this.page.locator('select[name*="type"]'))
      .first();
    await typeBtn.click({ force: true });
  }

  async assertKYCPending(): Promise<void> {
    const pending = this.page
      .getByText(/pending|under review|processing/i)
      .first();
    await pending.waitFor({ state: 'visible' });
    await expect(pending).toBeVisible();
  }
}
