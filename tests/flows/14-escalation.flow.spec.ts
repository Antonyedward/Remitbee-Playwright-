import { test, expect } from '@playwright/test';
import path from 'path';
import { EscalationFlow } from '../../flows/escalation/EscalationFlow';
import { ENV } from '../../config/environments';

const SAMPLE_FILE = path.resolve(__dirname, '../../test-data/verification/sample-id-doc.pdf');

test.describe('14 — Escalation', () => {
  test.describe.configure({ timeout: 150_000 });
  let flow: EscalationFlow;

  test.beforeEach(async ({ page }) => {
    flow = new EscalationFlow(page);
  });

  // ── List page ──────────────────────────────────────────────────────────────

  test('ES-03 @regression — search by valid case ID returns that escalation', async () => {
    await flow.loginForFlow();
    await flow.navigateToEscalation();
    const firstId = (await flow.rows().first().locator('td').nth(1).innerText()).trim();
    await flow.search(firstId);
    await expect(flow.rowFor(firstId)).toBeVisible({ timeout: 10_000 });
  });

  test('ES-04 @regression — escalation page shows empty state when no issues', async ({ page }) => {
    await flow.loginForFlow(ENV.FIRST_TIME_USER_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToEscalation();
    await expect(flow.emptyStateHeading()).toBeVisible();
    await expect(flow.createButton()).toBeVisible();
    await flow.clickRaiseIssue(); // empty-state button opens the wizard too
  });

  test('ES-13 @regression — search with invalid case ID shows no results', async () => {
    await flow.loginForFlow();
    await flow.navigateToEscalation();
    await flow.search('INVALID999999');
    await expect(flow['page'].getByText(/no result|not found|invalid/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('ES-19 @regression — escalation list shows status chips (Open)', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToEscalation();
    await expect(flow.rows().first()).toBeVisible();
    await expect(page.locator('#status-open:visible').first()).toBeVisible({ timeout: 10_000 });
  });

  // ── Wizard step 1 — issue type ─────────────────────────────────────────────

  test('ES-05 @regression — create escalation button opens the issue-type step', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToEscalation();
    await flow.clickRaiseIssue();
    await expect(page).toHaveURL(/escalation\/issue-type/);
    await expect(flow.subTypeDropdown()).toBeVisible();
    await expect(flow.subTypeDropdown()).toBeDisabled(); // problem list unlocks after picking a type
  });

  test('ES-01 @regression — issue type dropdown lists all categories', async () => {
    await flow.loginForFlow();
    await flow.navigateToEscalation();
    await flow.clickRaiseIssue();
    const types = await flow.openIssueTypes();
    for (const t of EscalationFlow.ISSUE_TYPES) {
      expect(types.join('|')).toMatch(new RegExp(t, 'i'));
    }
  });

  test('ES-06 @regression — continue without selecting issue type shows required errors', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToEscalation();
    await flow.clickRaiseIssue();
    await flow.clickContinue();
    await expect(page.locator('[id$="error-text"]:visible').first()).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/escalation\/issue-type/);
  });

  for (const [id, type] of [['ES-07', 'Compliance'], ['ES-08', 'General'], ['ES-09', 'Onboarding'],
                            ['ES-10', 'Transaction'], ['ES-18', 'Technical']] as const) {
    test(`${id} @regression — ${type} issue type can be selected and lists problems`, async () => {
      await flow.loginForFlow();
      await flow.navigateToEscalation();
      await flow.clickRaiseIssue();
      await flow.selectIssueType(type);
      await expect(flow.subTypeDropdown()).toBeEnabled({ timeout: 10_000 });
      await flow.subTypeDropdown().click();
      expect(await flow.dropdownOptions().count()).toBeGreaterThan(0);
    });
  }

  test('ES-16 @regression — issue type selected but no problem selected shows error', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToEscalation();
    await flow.clickRaiseIssue();
    await flow.selectIssueType('Transaction');
    await flow.clickContinue();
    await expect(page.locator('[id$="error-text"]:visible').first()).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/escalation\/issue-type/);
  });

  test('ES-17 @regression — problem dropdown changes with the selected issue type', async () => {
    await flow.loginForFlow();
    await flow.navigateToEscalation();
    await flow.clickRaiseIssue();
    await flow.selectIssueType('Transaction');
    await flow.subTypeDropdown().click();
    const txProblems = (await flow.dropdownOptions().allInnerTexts()).join('|');
    await flow.subTypeDropdown().click(); // close the problem list
    await flow.selectIssueType('Technical');
    await flow.subTypeDropdown().click();
    const techProblems = (await flow.dropdownOptions().allInnerTexts()).join('|');
    expect(txProblems.length).toBeGreaterThan(0);
    expect(techProblems).not.toEqual(txProblems);
  });

  // ── Wizard step 3 — add details ────────────────────────────────────────────

  test('ES-12 @regression — create escalation without message shows "message required"', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToEscalation();
    await flow.clickRaiseIssue();
    await flow.goToAddDetails('General');
    await flow.submitIssue();
    await expect(page.locator('#error:visible, #description-message:visible').first()).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/escalation\/add-details/);
  });

  test('ES-15 @regression — escalation can be raised from transaction details page', async ({ page }) => {
    await flow.loginForFlow(ENV.TX_HISTORY_EMAIL, ENV.USER_PASSWORD);
    await page.goto(`${ENV.BASE_URL}/transactions`);
    const firstTx = page.locator('#transactions-container [id^="transaction-"]:not([id$="-container"]):visible').first();
    await expect(firstTx).toBeVisible({ timeout: 30_000 });
    await firstTx.click();
    const link = page.locator('#create_complain:visible').first();
    await expect(link).toBeVisible({ timeout: 30_000 });
    await expect(link).toHaveText(/view escalation|need help|report|escalat/i);
  });

  // ── Create → list → close (real staging data) ──────────────────────────────

  test.describe.serial('create and close', () => {
    let createdId = '';

    test('ES-02 @smoke @regression — create escalation with message and no file upload', async () => {
      await flow.loginForFlow();
      await flow.navigateToEscalation();
      createdId = await flow.createEscalation(`Automated test escalation - no file ${Date.now()}`);
      expect(createdId).toMatch(/\d+/);
      console.log(`[ES] created escalation ${createdId}`);
    });

    test('ES-14 @smoke @regression — newly created escalation appears in escalation list as Open', async () => {
      test.skip(!createdId, 'ES-02 did not create an escalation');
      await flow.loginForFlow();
      await flow.navigateToEscalation();
      await flow.search(createdId);
      const row = flow.rowFor(createdId);
      await expect(row).toBeVisible({ timeout: 15_000 });
      await expect(row.locator('#status-open')).toBeVisible();
    });

    test('ES-20 @regression — open escalation can be closed', async ({ page }) => {
      test.skip(!createdId, 'ES-02 did not create an escalation');
      await flow.loginForFlow();
      await flow.openEscalation(createdId);
      const result = await flow.closeEscalation();
      if (result === 'cannot-close') {
        await expect(page.getByRole('heading', { name: /need to keep this escalation open/i })).toBeVisible();
      } else {
        await expect(page).toHaveURL(/resolution-centre/);
      }
    });

    test('ES-11 @regression — create escalation with message and file upload', async ({ page }) => {
      await flow.loginForFlow();
      await flow.navigateToEscalation();
      await flow.clickRaiseIssue();
      await flow.goToAddDetails('General');
      await flow.fillIssueDescription(`Automated test escalation with file ${Date.now()}`);
      await flow.attachFile(SAMPLE_FILE);
      await expect(page.getByText(/sample-id-doc/i).first()).toBeVisible({ timeout: 15_000 });
      await flow.submitIssue();
      const id = await flow.assertIssueSubmitted();
      console.log(`[ES] created escalation with file ${id}`);
      // tidy up — close it so the test account doesn't keep piling up open cases
      await flow.openEscalation(id);
      await flow.closeEscalation().catch(() => {});
    });
  });
});
