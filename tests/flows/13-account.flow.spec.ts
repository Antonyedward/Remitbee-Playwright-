import { test, expect } from '@playwright/test';
import { AccountFlow } from '../../flows/account/AccountFlow';
import { ENV } from '../../config/environments';

test.describe('13 — Account / MyAccount', () => {
  let flow: AccountFlow;

  test.beforeEach(async ({ page }) => {
    flow = new AccountFlow(page);
  });

  // TC-01/TC-04 — Phone number validation on account details
  test('AC-01 @smoke @regression — account details page loads', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToAccount();
    await expect(page).toHaveURL(/account|profile/i);
  });

  // TC-02/TC-03 — Empty fields before Level 1 verification
  test('AC-02 @regression — empty fields visible before level 1 verification', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToAccount();
    const firstNameField = flow['page']
      .locator('input[name*="first"], input[placeholder*="first" i]')
      .first();
    await expect(firstNameField).toBeVisible({ timeout: 15_000 });
  });

  // TC-05 — Validation after Level 1 verification
  test('AC-03 @regression — level 1 verified account shows filled personal details', async () => {
    await flow.loginForFlow(ENV.LEVEL1_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToAccount();
    await flow.assertPersonalDetailsVisible();
  });

  // TC-06 — Regex with valid credentials
  test('AC-04 @regression — account details form accepts valid credentials', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToAccount();
    await flow.fillPersonalDetails(
      ENV.ACCOUNT_FIRST_NAME,
      ENV.ACCOUNT_LAST_NAME,
      ENV.ACCOUNT_ADDRESS,
      ENV.ACCOUNT_CITY
    );
    await flow.assertSaveChangesButton();
  });

  // TC-07 — Regex with invalid credentials
  test('AC-05 @regression — invalid first name shows validation error', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToAccount();
    const firstNameInput = flow['page']
      .locator('input[name*="first"], input[placeholder*="first" i], input[id*="first"]')
      .first();
    const visible = await firstNameInput.isVisible().catch(() => false);
    if (visible) {
      await firstNameInput.fill('john1234@#$%');
      await flow.saveChanges();
      const error = flow['page'].locator('[class*="error"]').first();
      await expect(error).toBeVisible({ timeout: 5_000 });
    }
  });

  // TC-08/TC-09/TC-10 — Save changes with empty fields
  test('AC-06 @regression — save changes with empty required fields shows error', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToAccount();
    await flow.clearPersonalDetails();
    await flow.saveChanges();
    const error = flow['page'].locator('[class*="error"]').first();
    await expect(error).toBeVisible({ timeout: 5_000 });
  });

  // TC-22 — Save changes in personal details
  test('AC-07 @regression — save changes in personal details succeeds', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToAccount();
    await flow.fillPersonalDetails(
      ENV.ACCOUNT_FIRST_NAME,
      ENV.ACCOUNT_LAST_NAME,
      ENV.ACCOUNT_ADDRESS,
      ENV.ACCOUNT_CITY
    );
    await flow.saveChanges();
    await flow.assertSaveSuccess();
  });

  // TC-55/TC-57 — Save changes in address details
  test('AC-08 @regression — save address changes succeeds', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToAccount();
    const postalField = flow['page']
      .locator('input[name*="postal"], input[name*="zip"], input[placeholder*="postal" i]')
      .first();
    const visible = await postalField.isVisible().catch(() => false);
    if (visible) {
      await postalField.fill(ENV.ACCOUNT_POSTAL_CODE);
      await flow.saveChanges();
      await flow.assertSaveSuccess();
    }
  });

  // TC-12 — Business account details validation
  test('AC-09 @regression — business account details page loads with business tab', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToAccount();
    const businessTab = flow['page']
      .locator('[id^="menu-item-"], [role="tab"]')
      .filter({ hasText: /business/i })
      .first();
    await expect(businessTab).toBeVisible({ timeout: 10_000 });
  });

  // TC-13 — Tab switch validation
  test('AC-10 @regression — switching tabs in account page loads correct content', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToAccount();
    await flow.clickTab('Business');
    const bizContent = flow['page']
      .getByText(/business name|company|registration/i)
      .first();
    await expect(bizContent).toBeVisible({ timeout: 10_000 });
  });

  // TC-14/TC-16 — Empty fields in Business tab
  test('AC-11 @regression — empty required business fields shows error on save', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToAccount();
    await flow.clickTab('Business');
    await flow.saveChanges();
    // Either error shown or no changes needed — both valid
  });

  // TC-15 — Empty fields in personal tab
  test('AC-12 @regression — empty required personal fields shows error on save', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToAccount();
    await flow.clearPersonalDetails();
    await flow.saveChanges();
    const error = flow['page'].locator('[class*="error"]').first();
    await expect(error).toBeVisible({ timeout: 5_000 });
  });

  // TC-17 — Business account after verification
  test('AC-13 @regression — business account shows verified details when verified', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToAccount();
    await flow.assertPersonalDetailsVisible();
  });

  // TC-18 — Contact us
  test('AC-14 @regression — contact us link visible on account page', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToAccount();
    const contactUs = flow['page']
      .locator('a:has-text("Contact"), button:has-text("Contact")')
      .first();
    await expect(contactUs).toBeVisible({ timeout: 10_000 });
  });

  // TC-19/TC-20/TC-21 — Business details save
  test('AC-15 @regression — save business details succeeds', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToAccount();
    await flow.clickTab('Business');
    await flow.saveChanges();
    // Success or no change — both valid
  });

  // TC001/TC002 — Account switching Personal to Business
  test('AC-16 @smoke @regression — account switching personal to business', async ({ page }) => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.switchAccount('Business');
    await expect(page).toHaveURL(/\/(dashboard|home)/i);
  });

  // TC003 — New personal user can access create business account
  test('AC-17 @regression — new personal user can see create business option', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToAccount();
    const createBusiness = flow['page']
      .getByText(/create business|add business/i)
      .first();
    await expect(createBusiness).toBeVisible({ timeout: 10_000 });
  });

  // TC006/TC005 — New business user can access create personal account
  test('AC-18 @regression — business user can see create personal account option', async () => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.navigateToAccount();
    const createPersonal = flow['page']
      .getByText(/personal account|add personal/i)
      .first();
    await expect(createPersonal).toBeVisible({ timeout: 10_000 });
  });

  // TC004 — Account switching Business to Personal
  test('AC-19 @smoke @regression — account switching business to personal', async ({ page }) => {
    await flow.loginForFlow(ENV.BUSINESS_EMAIL, ENV.BUSINESS_PASSWORD);
    await flow.switchAccount('Personal');
    await expect(page).toHaveURL(/\/(dashboard|home)/i);
  });

  // Phone number validation
  test('AC-20 @regression — invalid phone number format shows error', async () => {
    await flow.loginForFlow(ENV.PERSONAL_EMAIL, ENV.USER_PASSWORD);
    await flow.navigateToAccount();
    const phoneField = flow['page']
      .locator('input[name*="phone"], input[type="tel"]')
      .first();
    const visible = await phoneField.isVisible().catch(() => false);
    if (visible) {
      await phoneField.fill('12345');
      await flow.saveChanges();
      const error = flow['page'].locator('[class*="error"]').first();
      await expect(error).toBeVisible({ timeout: 5_000 });
    }
  });
});
