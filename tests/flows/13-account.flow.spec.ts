import { test, expect, Page } from '@playwright/test';
import { AccountFlow } from '../../flows/account/AccountFlow';
import { VerificationFlow } from '../../flows/verification/VerificationFlow';
import { ENV } from '../../config/environments';

/**
 * 13 — Account details (/account-details) and account switching.
 * PERSONAL_EMAIL is Level-1 verified (personal details locked) and owns both accounts;
 * BUSINESS_EMAIL is a business account. Editable-field validation runs on a brand-new
 * (unverified) personal account created in the serial group below.
 */
test.describe('13 — Account / MyAccount (existing accounts)', () => {
  test.describe.configure({ timeout: 150_000 });
  let flow: AccountFlow;

  test.beforeEach(async ({ page }) => {
    flow = new AccountFlow(page);
  });

  test('AC-01 @smoke @regression — account details page loads', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToAccount();
    await expect(page).toHaveURL(/account-details/i);
    for (const h of [/personal details/i, /contact information/i, /your address/i]) {
      await expect(page.getByRole('heading', { name: h }).first()).toBeVisible();
    }
  });

  test('AC-03 @regression — level 1 verified account shows filled, locked personal details', async ({ page }) => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToAccount();
    for (const id of ['cus_firstname', 'cus_lastname', 'cus_email', 'cus_phone1', 'cus_city']) {
      await expect(flow.input(id)).toBeDisabled();
      await expect(flow.input(id)).not.toHaveValue('');
    }
    await expect(page.getByText(/no changes can be made to your personal details once they are verified/i).first()).toBeVisible();
  });

  test('AC-04 @regression — editing verified personal details shows "Information cannot be edited"', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToAccount();
    await flow.editLink(0).click();
    const dialog = flow.cannotEditDialog();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toContainText(/information cannot be edited/i);
    await expect(dialog).toContainText(/chat with us/i);
    await flow.closeDialog(dialog);
  });

  test('AC-07 @regression — save changes in personal details succeeds (unit number)', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToAccount();
    const unit = flow.input('cus_address2');
    await expect(unit).toBeEditable();
    const current = await unit.inputValue();
    const next = current === '101' ? '102' : '101';   // must differ, or the form submits nothing
    await unit.fill(next);
    await flow.saveChanges();
    await flow.assertSaveSuccess();
    await expect(unit).toHaveValue(next);
  });

  test('AC-08 @regression — editing the address opens the edit-address dialog', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToAccount();
    await flow.editLink(2).click();
    const dialog = flow['page'].locator('#edit-address-dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.locator('#dialog-button-primaryAction')).toBeVisible();
    await dialog.locator('#dialog-button-secondaryAction').click(); // Cancel
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  });

  test('AC-14 @regression — contact us link visible on account page', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToAccount();
    const contactUs = flow['page'].locator('a:has-text("Contact"), button:has-text("Contact")').first();
    await expect(contactUs).toBeVisible({ timeout: 10_000 });
    await contactUs.click();
    await expect(flow.cannotEditDialog()).toBeVisible({ timeout: 10_000 });
    await flow.closeDialog(flow.cannotEditDialog());
  });

  // ── Business account ───────────────────────────────────────────────────────

  test('AC-09 @regression — business account details page shows business and personal tabs', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToAccount();
    await expect(flow.businessTab()).toBeVisible({ timeout: 15_000 });
    await expect(flow.personalTab()).toBeVisible();
  });

  test('AC-10 @regression — switching tabs in account page loads correct content', async ({ page }) => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToAccount();
    await flow.personalTab().click();
    await expect(page.getByRole('heading', { name: /personal details/i }).first()).toBeVisible({ timeout: 15_000 });
    await expect(flow.input('cus_firstname')).toBeVisible();
    await flow.businessTab().click();
    await expect(page.getByRole('heading', { name: /business details/i }).first()).toBeVisible({ timeout: 15_000 });
    await expect(flow.input('business_name')).toBeVisible();
    await expect(page.getByRole('heading', { name: /business address/i }).first()).toBeVisible();
  });

  test('AC-11 @regression — business details fields are read-only', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToAccount();
    await flow.businessTab().click();
    for (const id of ['business_name', 'registration_no', 'cus_email', 'cus_phone1']) {
      await expect(flow.input(id)).toBeDisabled();
    }
  });

  test('AC-13 @regression — business account shows verified details when verified', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToAccount();
    await expect(flow.input('cus_email')).not.toHaveValue('');
  });

  test('AC-15 @regression — save with empty required business fields shows "This field is required."', async ({ page }) => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToAccount();
    await flow.businessTab().click();
    await flow.saveChanges();
    // The test business has no registered name / registration no. / industry on file → required errors, no save
    const errors = page.locator('[id$="-error-text"]:visible');
    await expect(errors.first()).toBeVisible({ timeout: 10_000 });
    await expect(errors.filter({ hasText: /this field is required/i }).first()).toBeVisible();
    await expect(flow.successDialog()).toBeHidden();
    await expect(page).toHaveURL(/account-details/);
  });

  // ── Account switching (user menu) ──────────────────────────────────────────

  test('AC-17 @regression — personal user sees the business account option in the user menu', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    expect(await flow.getSwitchLabel()).toMatch(/(switch to|open a) business account/i);
  });

  test('AC-18 @regression — business user sees the personal account option in the user menu', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    expect(await flow.getSwitchLabel()).toMatch(/(switch to|open a) personal account/i);
  });

  test('AC-16 @smoke @regression — account switching personal to business (and back)', async ({ page }) => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    const label = await flow.getSwitchLabel();
    test.skip(!/switch to business/i.test(label), `Account has no business account (menu shows "${label}")`);
    await page.keyboard.press('Escape');
    try {
      await flow.switchAccount('Business');
      await expect(page).toHaveURL(/business-account\/dashboard/);
    } finally {
      // last_active_ac is saved server-side — always switch back so other modules log in as personal
      if (flow.isBusinessActive()) await flow.switchAccount('Personal');
    }
    await expect(page).toHaveURL(/\/dashboard/);
    expect(flow.isBusinessActive()).toBe(false);
  });

  test('AC-19 @smoke @regression — account switching business to personal (and back)', async ({ page }) => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    const label = await flow.getSwitchLabel();
    if (/open a personal account/i.test(label)) {
      // Business-only customer: the option leads to personal-account creation
      await flow.switchMenuItem().click();
      await page.waitForURL(/create-personal/, { timeout: 30_000 });
      return;
    }
    await page.keyboard.press('Escape');
    try {
      await flow.switchAccount('Personal');
      expect(flow.isBusinessActive()).toBe(false);
    } finally {
      if (!flow.isBusinessActive()) await flow.switchAccount('Business');
    }
    await expect(page).toHaveURL(/business-account\/dashboard/);
  });
});

/** Editable-field validation needs an unverified account — create one fresh. */
test.describe.serial('13 — Account / MyAccount (new unverified account)', () => {
  test.describe.configure({ timeout: 240_000 });
  let page: Page;
  let flow: AccountFlow;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    page = await browser.newPage();
    const email = await new VerificationFlow(page).signupFreshPersonal();
    console.log(`[AC] new account: ${email}`);
    flow = new AccountFlow(page);
  });

  test.afterAll(async () => {
    await page?.close();
  });

  test('AC-02 @regression — empty, editable personal fields before level 1 verification', async () => {
    await flow.navigateToAccount();
    for (const id of ['cus_firstname', 'cus_lastname', 'cus_city']) {
      await expect(flow.input(id)).toBeVisible();
      await expect(flow.input(id)).toHaveValue('');
      await expect(flow.input(id)).toBeEditable();
    }
  });

  test('AC-05 @regression — invalid first name shows validation error', async () => {
    await flow.navigateToAccount();
    await flow.input('cus_firstname').fill('john1234@#$%');
    await flow.input('cus_lastname').fill('Doe');
    await flow.saveChanges();
    await expect(flow.errorText('cus_firstname')).toBeVisible({ timeout: 10_000 });
    await expect(flow.errorText('cus_lastname')).toHaveCount(0);
    await expect(flow.successDialog()).toBeHidden();
  });

  test('AC-06 @regression — save changes with empty required fields shows error', async () => {
    await flow.navigateToAccount();
    await flow.saveChanges();
    for (const id of ['cus_firstname', 'cus_lastname', 'cus_city']) {
      await expect(flow.errorText(id)).toBeVisible({ timeout: 10_000 });
    }
    await expect(flow.successDialog()).toBeHidden();
  });

  test('AC-12 @regression — clearing a filled required field shows error on save', async () => {
    await flow.navigateToAccount();
    await flow.input('cus_firstname').fill('John');
    await flow.input('cus_firstname').fill('');
    await flow.saveChanges();
    await expect(flow.errorText('cus_firstname')).toBeVisible({ timeout: 10_000 });
  });

  test('AC-20 @regression — invalid postal code format shows error', async () => {
    await flow.navigateToAccount();
    await flow.input('cus_postal').fill('12345');
    await flow.saveChanges();
    await expect(flow.errorText('cus_postal')).toBeVisible({ timeout: 10_000 });
    await expect(flow.successDialog()).toBeHidden();
  });
});
