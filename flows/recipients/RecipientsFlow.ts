/**
 * RecipientsFlow — covers the full recipients module:
 *
 *  List       /recipients
 *  Add wizard /recipients/add/add-country
 *             /recipients/add/add-receiving-method
 *             /recipients/add/add-beneficiary
 *  Edit       /recipients/edit
 *
 * Element IDs taken directly from:
 *   src/components/recipients-v2/  (RecipientsWizard, AddRecipient, EditRecipientContainer)
 *   src/components/sendMoneyV2/RecipientDetails/  (AddCountry, AddReceivingMethod, BeneficiaryForm)
 *   Selenium POM: RecipientsPage.java, AddRecipientPage*.java
 */

import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

export class RecipientsFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  /** Default IFSC for India bank-deposit recipients (real SBI branch code, valid format). */
  static readonly DEFAULT_IFSC = 'SBIN0000001';

  /**
   * Unique, letters-only recipient name. Names must not contain digits — the live form rejects
   * 'PW' + Date.now() with "This first name may contain invalid characters" (seen RC-17..19).
   * Maps each timestamp digit 0-9 to A-J.
   */
  /**
   * Staging rejects a second recipient with the same bank details (BE035 "…with this receiving method
   * already exists"), so every run needs a fresh account number. 12 digits from the timestamp.
   */
  static uniqueAccountNumber(): string {
    return String(Date.now()).slice(-10) + String(Math.floor(Math.random() * 90) + 10);
  }

  static uniqueName(prefix = 'PW'): string {
    return prefix + String(Date.now()).split('').map(d => String.fromCharCode(65 + Number(d))).join('');
  }

  // ══════════════════════════════════════════════════════════════════
  //  RECIPIENTS LIST  /recipients
  // ══════════════════════════════════════════════════════════════════

  async navigateToRecipients(): Promise<void> {
    await this.navigateSidebar('Recipients');
    await this.page.waitForURL(/\/recipients(\?|$)/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
    // RecipientsContainer.tsx renders #add-new-recipient only after the list finishes loading
    // (!loading). Accounts with long recipient lists take well over 20s (seen live, RC-06).
    await this.page.locator('#add-new-recipient:visible, [class*="Splash"]:visible').first()
      .waitFor({ state: 'visible', timeout: 90_000 });
  }

  /** Splash / empty state or list container */
  async assertRecipientsPageLoaded(): Promise<void> {
    // Either the list or the splash (no recipients yet) should be present
    const listOrSplash = this.page
      .locator('#add-new-recipient, [class*="RecipientList"], [class*="Splash"]')
      .first();
    await listOrSplash.waitFor({ state: 'visible', timeout: 15_000 });
  }

  /** Click "Add new recipient" — id="add-new-recipient" */
  async clickAddNewRecipient(): Promise<void> {
    const btn = this.page.locator('#add-new-recipient:visible').first();
    await btn.waitFor({ state: 'visible', timeout: 45_000 });
    await btn.click();
    await this.page.waitForURL(/\/recipients\/add/i, { timeout: 15_000 });
  }

  /** Click the first recipient in the list */
  async clickFirstRecipient(): Promise<void> {
    const first = this.page.locator("[class*='RecipientList_rb-text-container']").first();
    await first.waitFor({ state: 'visible' });
    await first.click();
  }

  /** Assert a named recipient appears in the list — id="recipient-id-{name}" */
  async assertRecipientInList(name: string): Promise<void> {
    const el = this.page.locator(`[id="recipient-id-${name}"]`);
    await el.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(el).toBeVisible();
  }

  /** Recipient added success dialog — id="recipient-added-dialog" */
  async assertRecipientAddedDialog(): Promise<void> {
    // Live trace: saveCustomerBeneficiaryMutationV2 takes ~13s on staging, then the app redirects to
    // /recipients and only opens the dialog after beneficiaryPaginatedQuery (7s+) returns
    // (RecipientsContainer.tsx renders it when recipientSuccessdialog && addedRecipient).
    await this.page.waitForURL(/\/recipients\/?(\?.*)?$/, { timeout: 60_000 });
    await expect(this.page.locator('#recipient-added-dialog')).toBeVisible({ timeout: 60_000 });
    await expect(this.page.getByText(/new recipient added/i).first()).toBeVisible();
  }

  /** "Got it" button on success dialog — id="dialog-button-primaryAction" */
  async clickGotIt(): Promise<void> {
    await this.page.locator('#recipient-added-dialog #dialog-button-primaryAction, #dialog-button-primaryAction:visible').first().click();
  }

  // ══════════════════════════════════════════════════════════════════
  //  ADD RECIPIENT — STEP 0: Country selection
  //  URL: /recipients/add/add-country
  // ══════════════════════════════════════════════════════════════════

  async assertAddCountryStep(): Promise<void> {
    await this.page.waitForURL(/add-country/i, { timeout: 10_000 });
    // DropDownField.tsx puts the id on BOTH a container <div> and a <button> — target the button
    // (an unqualified '#send-money-country-selection' is a strict-mode violation; seen live RC-03..10).
    await expect(this.page.locator('button#send-money-country-selection')).toBeVisible({ timeout: 15_000 });
  }

  /**
   * Select recipient country.
   * Dropdown: id="send-money-country-selection"
   * Search input appears after click; items in #list-container
   */
  async selectRecipientCountry(countryName: string): Promise<void> {
    const field = this.page.locator('button#send-money-country-selection');
    await field.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(async () => {
      if (!((await field.textContent()) ?? '').match(new RegExp(countryName, 'i'))) {
        // DropDownList renders its search box as input#search (sibling of the field, not inside it)
        const search = this.page.locator('input#search');
        if (!(await search.isVisible().catch(() => false))) await field.click();
        await search.waitFor({ state: 'visible', timeout: 5_000 });
        await search.fill(countryName);
        await this.page.locator('li[data-item]:visible')
          .filter({ hasText: new RegExp(`^\\s*${countryName}\\b`, 'i') })
          .first().click({ timeout: 5_000 });
      }
      await expect(field).toContainText(new RegExp(countryName, 'i'), { timeout: 3_000 });
    }).toPass({ timeout: 30_000, intervals: [500, 1_000, 2_000] });
  }

  /**
   * Pick the first country in the list that has more than one receiving currency — only then does
   * AddCountry.tsx render the #send-money-currency-selection dropdown. Each option's data-item JSON
   * carries its `currencies` array, so this is data-driven rather than a guessed country name.
   * Returns the chosen country name.
   */
  async selectFirstMultiCurrencyCountry(): Promise<string> {
    const field = this.page.locator('button#send-money-country-selection');
    await field.waitFor({ state: 'visible', timeout: 15_000 });
    await field.click();
    await this.page.locator('li[data-item]:visible').first().waitFor({ state: 'visible', timeout: 10_000 });
    const index = await this.page.locator('li[data-item]').evaluateAll((els) =>
      els.findIndex((el) => {
        try { return (JSON.parse(el.getAttribute('data-item') || '{}').currencies || []).length > 1; }
        catch { return false; }
      }));
    if (index < 0) throw new Error('No country with more than one receiving currency in the list');
    const option = this.page.locator('li[data-item]').nth(index);
    const name = ((await option.textContent()) ?? '').trim();
    await option.scrollIntoViewIfNeeded();
    await option.click();
    await expect(field).not.toContainText(/select country/i, { timeout: 5_000 });
    return name;
  }

  /**
   * Select receiving currency.
   * Dropdown: id="send-money-currency-selection"
   */
  async selectReceivingCurrency(currencyName: string): Promise<void> {
    const field = this.page.locator('button#send-money-currency-selection');
    await field.click();
    await this.page.locator('li[data-item]:visible').filter({ hasText: currencyName }).first().click();
    await expect(field).toContainText(currencyName, { timeout: 5_000 });
  }

  /** Continue from country step — id="send-money-addCountry" */
  async clickCountryContinue(): Promise<void> {
    await this.page.locator('#send-money-addCountry').click();
    await this.page.waitForURL(/add-receiving-method/i, { timeout: 10_000 });
  }

  // ══════════════════════════════════════════════════════════════════
  //  ADD RECIPIENT — STEP 1: Receiving method selection
  //  URL: /recipients/add/add-receiving-method
  // ══════════════════════════════════════════════════════════════════

  async assertAddReceivingMethodStep(): Promise<void> {
    await this.page.waitForURL(/add-receiving-method/i, { timeout: 10_000 });
    await expect(this.page.locator('#recipients-select-method')).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Select a main receiving method by label text.
   * The method list is rendered after id="recipients-select-method".
   */
  /**
   * Receiving-method options (AddReceivingMethod.tsx). Labels come from the backend per corridor —
   * for India the live page shows "Bank deposit" (default-selected) and "UPI"; older data used
   * "Bank Transfer", so accept either for the bank option.
   */
  async selectReceivingMethod(methodLabel: string): Promise<void> {
    const pattern = /^bank (deposit|transfer)$/i.test(methodLabel)
      ? /^\s*bank (deposit|transfer)\s*$/i
      : new RegExp(`^\\s*${methodLabel}\\s*$`, 'i');
    // Note: #recipients-select-method is the step HEADING (Typography), not a container of the options.
    const method = this.page.getByText(pattern).first();
    await method.waitFor({ state: 'visible', timeout: 20_000 });
    await method.click();
  }

  /** Continue from receiving method step — id="recipients-addCountry" */
  async clickReceivingMethodContinue(): Promise<void> {
    await this.page.locator('#recipients-addCountry').click();
    await this.page.waitForURL(/add-beneficiary/i, { timeout: 15_000 });
  }

  // ══════════════════════════════════════════════════════════════════
  //  ADD RECIPIENT — STEP 2: Beneficiary form
  //  URL: /recipients/add/add-beneficiary
  // ══════════════════════════════════════════════════════════════════

  async assertBeneficiaryFormStep(): Promise<void> {
    await this.page.waitForURL(/add-beneficiary/i, { timeout: 10_000 });
  }

  /** Select Personal recipient type — id="person-input" */
  async selectPersonalRecipient(): Promise<void> {
    const el = this.page.locator('#person-input');
    const visible = await el.isVisible().catch(() => false);
    if (visible) await el.click({ force: true });
  }

  /** Select Business recipient type — id="business-label" */
  async selectBusinessRecipient(): Promise<void> {
    const el = this.page.locator('#business-label');
    const visible = await el.isVisible().catch(() => false);
    if (visible) await el.click({ force: true });
  }

  /** First name — id="ben_firstname" */
  async fillFirstName(firstName: string): Promise<void> {
    await this.page.locator('#ben_firstname').fill(firstName);
  }

  /** Last name — id="ben_lastname" */
  async fillLastName(lastName: string): Promise<void> {
    await this.page.locator('#ben_lastname').fill(lastName);
  }

  /** Company name — id="ben_company_name" */
  async fillCompanyName(companyName: string): Promise<void> {
    await this.page.locator('#ben_company_name').fill(companyName);
  }

  /** Email — id="ben_email" */
  async fillBeneficiaryEmail(email: string): Promise<void> {
    const el = this.page.locator('#ben_email');
    if (await el.isVisible().catch(() => false)) await el.fill(email);
  }

  /** Bank account number (various IDs depending on country method) */
  async fillAccountNumber(accountNumber: string): Promise<void> {
    // Try common field IDs in order
    for (const id of ['ben_bank_account_number', 'iban', 'clabe']) {
      const el = this.page.locator(`#${id}`);
      if (await el.isVisible().catch(() => false)) {
        await el.fill(accountNumber);
        return;
      }
    }
    // Fallback: any visible account number input
    const fallback = this.page.locator("//div[contains(text(),'Account number')]/../../..//input").first();
    if (await fallback.isVisible().catch(() => false)) await fallback.fill(accountNumber);
  }

  /** IFSC code — id="ifsc" */
  async fillIFSC(code: string): Promise<void> {
    const el = this.page.locator('#ifsc');
    if (await el.isVisible().catch(() => false)) await el.fill(code);
  }

  /** Swift code — id="swift" */
  async fillSwift(code: string): Promise<void> {
    const el = this.page.locator('#swift');
    if (await el.isVisible().catch(() => false)) await el.fill(code);
  }

  /** ABA / ACH routing — id="aba" */
  async fillABA(aba: string): Promise<void> {
    const el = this.page.locator('#aba');
    if (await el.isVisible().catch(() => false)) await el.fill(aba);
  }

  /** Sort code (UK) — id="sort" */
  async fillSortCode(sort: string): Promise<void> {
    const el = this.page.locator('#sort');
    if (await el.isVisible().catch(() => false)) await el.fill(sort);
  }

  /** Address — id="ben_address1" */
  async fillAddress(address: string): Promise<void> {
    const el = this.page.locator('#ben_address1');
    if (await el.isVisible().catch(() => false)) await el.fill(address);
  }

  /** City — id="ben_city" */
  async fillCity(city: string): Promise<void> {
    const el = this.page.locator('#ben_city');
    if (await el.isVisible().catch(() => false)) await el.fill(city);
  }

  /** Province/State text input — id="ben_province" */
  async fillProvince(province: string): Promise<void> {
    const el = this.page.locator('#ben_province');
    if (await el.isVisible().catch(() => false)) await el.fill(province);
  }

  /** Postal code — id="ben_postal" */
  async fillPostal(postal: string): Promise<void> {
    const el = this.page.locator('#ben_postal');
    if (await el.isVisible().catch(() => false)) await el.fill(postal);
  }

  /** Nick name — id="ben_nick_name" */
  async fillNickName(nick: string): Promise<void> {
    const el = this.page.locator('#ben_nick_name');
    if (await el.isVisible().catch(() => false)) await el.fill(nick);
  }

  /** Continue/submit form — button id="continue" */
  async clickBeneficiaryContinue(): Promise<void> {
    await this.page.locator('button#continue, button[type="submit"]').first().click({ force: true });
  }

  // ── Validation errors on beneficiary form ──────────────────────────────────

  async assertFirstNameError(): Promise<void> {
    await expect(this.page.locator('#ben_firstname-error-text, [class*="errorText"]').first()).toBeVisible({ timeout: 8_000 });
  }

  async assertLastNameError(): Promise<void> {
    await expect(this.page.locator('#ben_lastname-error-text, [class*="errorText"]').first()).toBeVisible({ timeout: 8_000 });
  }

  async assertAddressError(): Promise<void> {
    await expect(this.page.locator('#ben_address1-error-text')).toBeVisible({ timeout: 8_000 });
  }

  async assertCityError(): Promise<void> {
    await expect(this.page.locator('#ben_city-error-text')).toBeVisible({ timeout: 8_000 });
  }

  async assertPostalError(): Promise<void> {
    await expect(this.page.locator('#ben_postal-error-text')).toBeVisible({ timeout: 8_000 });
  }

  // ══════════════════════════════════════════════════════════════════
  //  EDIT RECIPIENT  /recipients/edit
  // ══════════════════════════════════════════════════════════════════

  async assertEditRecipientPageLoaded(): Promise<void> {
    await this.page.waitForURL(/\/recipients\/edit/i, { timeout: 15_000 });
    await expect(this.page.locator('#edit-recipient')).toBeVisible({ timeout: 10_000 });
  }

  /** Delete recipient button — id="delete-recipient" */
  async clickDeleteRecipient(): Promise<void> {
    await this.page.locator('#delete-recipient').click();
  }

  /** Confirm delete dialog — id="delete-recipient-dialog" */
  async assertDeleteDialog(): Promise<void> {
    await expect(this.page.locator('#delete-recipient-dialog')).toBeVisible({ timeout: 10_000 });
  }

  async confirmDeleteRecipient(): Promise<void> {
    // Secondary action = "Delete recipient"
    const deleteBtn = this.page.locator('#delete-recipient-dialog').locator('button').filter({ hasText: /delete recipient/i }).first();
    await deleteBtn.click({ force: true });
    await this.page.waitForURL(/\/recipients(\?|$)/i, { timeout: 20_000 });
  }

  async cancelDeleteRecipient(): Promise<void> {
    // Primary action = "Go back"
    const goBack = this.page.locator('#delete-recipient-dialog').locator('button').filter({ hasText: /go back/i }).first();
    await goBack.click();
  }

  /** Save changes button — id="save-recipient" */
  async clickSaveRecipient(): Promise<void> {
    await this.page.locator('#save-recipient').click({ force: true });
  }

  /** Name validation warning dialog — id="ben-name-warning-dialog" */
  async assertNameWarningDialog(): Promise<void> {
    await expect(this.page.locator('#ben-name-warning-dialog')).toBeVisible({ timeout: 10_000 });
  }

  async proceedWithNameWarning(): Promise<void> {
    // Primary action = proceed anyway
    const proceedBtn = this.page.locator('#ben-name-warning-dialog').locator('button').first();
    await proceedBtn.click({ force: true });
  }

  // ── Receiving method management ─────────────────────────────────────────────

  /** Remove receiving method dialog — id="remove-receiving-method" */
  async assertRemoveReceivingMethodDialog(): Promise<void> {
    await expect(this.page.locator('#remove-receiving-method')).toBeVisible({ timeout: 10_000 });
  }

  async confirmRemoveReceivingMethod(): Promise<void> {
    const removeBtn = this.page.locator('#remove-receiving-method').locator('button').first();
    await removeBtn.click({ force: true });
  }

  /** Receiving method removed success dialog — id="receiving-method-removed" */
  async assertReceivingMethodRemovedDialog(): Promise<void> {
    await expect(this.page.locator('#receiving-method-removed')).toBeVisible({ timeout: 10_000 });
  }

  async dismissReceivingMethodRemovedDialog(): Promise<void> {
    const gotItBtn = this.page.locator('#receiving-method-removed').locator('button:has-text("Got it")').first();
    await gotItBtn.click();
  }

  // ── Personal-fields section titles ─────────────────────────────────────────

  async assertPersonalFieldsSection(): Promise<void> {
    await expect(this.page.locator('#personal-fields')).toBeVisible({ timeout: 10_000 });
  }

  async assertContactFieldsSection(): Promise<void> {
    await expect(this.page.locator('#contact-fields')).toBeVisible({ timeout: 10_000 });
  }

  // ── Composite helpers ───────────────────────────────────────────────────────

  /**
   * Add a basic individual bank-transfer recipient end-to-end.
   * Caller must already be logged in.
   */
  async addRecipientEndToEnd(params: {
    country: string;
    currency?: string;
    method: string;
    firstName: string;
    lastName: string;
    accountNumber: string;
    ifsc?: string;
  }): Promise<void> {
    await this.navigateToRecipients();
    await this.clickAddNewRecipient();

    // Step 0: country
    await this.assertAddCountryStep();
    await this.selectRecipientCountry(params.country);
    if (params.currency) await this.selectReceivingCurrency(params.currency);
    await this.clickCountryContinue();

    // Step 1: method
    await this.assertAddReceivingMethodStep();
    await this.selectReceivingMethod(params.method);
    await this.clickReceivingMethodContinue();

    // Step 2: beneficiary
    await this.assertBeneficiaryFormStep();
    await this.selectPersonalRecipient();
    await this.fillFirstName(params.firstName);
    await this.fillLastName(params.lastName);
    await this.fillAccountNumber(params.accountNumber);
    // India (and similar corridors) require IFSC — fill it whenever the field is on the form.
    if (params.ifsc || await this.page.locator('#ifsc').isVisible().catch(() => false)) {
      await this.fillIFSC(params.ifsc ?? RecipientsFlow.DEFAULT_IFSC);
    }
    await this.clickBeneficiaryContinue();

    // Success dialog
    await this.assertRecipientAddedDialog();
    await this.clickGotIt();
  }
}
