import { Page, Locator, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';
import { ENV } from '../../config/environments';

export type DtoneService = 'mobile-top-up' | 'international-bill' | 'e-sim' | 'gift-card';

/**
 * DT One services — mobile top-up, international bills, eSIM, gift cards.
 * Live DOM (Jam 6c33f327) + CP source (pages/<service>, services-v2, mobileTopUp-v2, eSim, giftCards-v2,
 * internationalBills-v2):
 *  - /<service> shows a splash ("Let's get started") until the user's first purchase of that service.
 *  - Country step (shared CountrySelection): DropDown button#select-country-service, search input#search,
 *    options li[data-item]; Continue = #country-selection-continue.
 *  - Top-up: phone input#mobile-top-up → #recipient-phone-number → /details/products (#select-product-title,
 *    first plan auto-selected, #edit-carrier) → #continue → dialog "Continue to payment".
 *  - Bill: /utility (#utility-title, cards [id^="service-"]) → #utility-continue → /providers.
 *  - eSIM: /destination (#destination-mode-local|regional|global, #continue) → choose-destination
 *    (input#search-destination, country boxes id=<ISO2>) → select-product (#continue-button)
 *    → recipient-info (input#email-input, #continue).
 *  - Gift card: country → /order-details (input#email-input, operator cards #image-container,
 *    #select-operator-continue) → purchase (textarea#gift-text-area optional, #continue-button).
 *  - Payment type (all): radios #wallet-balance / #debit-card, Next = #select-pay-type-continue
 *    → /overview/summary (#submit-transaction "Confirm and pay").
 *  - Wizard close = #close-icon → /dashboard.
 */
export class DtoneFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  // ── Entry / splash ─────────────────────────────────────────────────────────

  async open(service: DtoneService): Promise<void> {
    await this.page.goto(`${ENV.BASE_URL}/${service}`, { waitUntil: 'domcontentloaded' });
    await this.page.waitForURL(new RegExp(service), { timeout: 30_000 });
    await this.dismissAllOverlays();
    await expect(this.splashButton().or(this.countryDropdown()).or(this.esimModeOption('local')).or(this.esimSearch()).first())
      .toBeVisible({ timeout: 45_000 });
  }

  /** Kept for older callers. */
  async navigateToDtone(): Promise<void> {
    await this.open('mobile-top-up');
  }

  splashButton(): Locator {
    return this.page.getByRole('button', { name: /let.s get started/i }).first();
  }

  /** Click "Let's get started" when the first-purchase splash is shown. */
  async startIfSplash(): Promise<void> {
    if (await this.splashButton().isVisible().catch(() => false)) {
      await expect(async () => {
        if (await this.splashButton().isVisible().catch(() => false)) await this.splashButton().click();
        await expect(this.splashButton()).toBeHidden({ timeout: 8_000 });
      }).toPass({ timeout: 40_000 });
    }
  }

  async openAndStart(service: DtoneService): Promise<void> {
    await this.open(service);
    await this.startIfSplash();
  }

  // ── Country step (top-up / bill / gift card) ───────────────────────────────

  countryDropdown(): Locator {
    return this.page.locator('button#select-country-service:visible').first();
  }

  dropdownOptions(): Locator {
    return this.page.locator('li[data-item]:visible');
  }

  async openCountryDropdown(): Promise<void> {
    await expect(this.countryDropdown()).toBeVisible({ timeout: 30_000 });
    await expect(async () => {
      if (!(await this.page.locator('input#search:visible').isVisible().catch(() => false))) {
        await this.countryDropdown().click();
      }
      await expect(this.page.locator('input#search:visible').first()).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
  }

  async searchCountry(text: string): Promise<void> {
    await this.openCountryDropdown();
    const search = this.page.locator('input#search:visible').first();
    await search.fill('');
    await search.pressSequentially(text, { delay: 40 });
    await this.page.waitForTimeout(600);
  }

  async selectCountry(country: string): Promise<void> {
    await this.searchCountry(country);
    const option = this.dropdownOptions().filter({ hasText: new RegExp(`^\\s*${country}\\s*$`, 'i') }).first();
    await expect(option).toBeVisible({ timeout: 15_000 });
    await option.click();
    await expect(this.countryDropdown()).toContainText(new RegExp(country, 'i'), { timeout: 10_000 });
  }

  async clickCountryContinue(): Promise<void> {
    await this.page.locator('#country-selection-continue:visible').first().click();
  }

  // ── Mobile top-up ──────────────────────────────────────────────────────────

  phoneInput(): Locator {
    return this.page.locator('input#mobile-top-up:visible').first();
  }

  async assertPhoneNumberTitle(): Promise<void> {
    await expect(this.page.locator('#enter-phone-number-title').first()).toBeVisible({ timeout: 20_000 });
    await expect(this.phoneInput()).toBeVisible();
  }

  async enterPhoneNumber(phone: string): Promise<void> {
    await expect(this.phoneInput()).toBeVisible({ timeout: 20_000 });
    await this.phoneInput().fill('');
    await this.phoneInput().pressSequentially(phone, { delay: 30 });
  }

  async assertProductTitle(): Promise<void> {
    await this.page.waitForURL(/mobile-top-up\/details\/products/, { timeout: 45_000 });
    await expect(this.page.locator('#select-product-title').first()).toBeVisible({ timeout: 30_000 });
  }

  /** Nigeria → phone → products page. */
  async topUpToProducts(country = ENV.DTONE_SUCCESS_COUNTRY, phone = ENV.DTONE_MOBILE_PHONE): Promise<void> {
    await this.openAndStart('mobile-top-up');
    await this.selectCountry(country);
    await this.clickCountryContinue();
    await this.page.waitForURL(/recipient-details\/phone-number/, { timeout: 30_000 });
    await this.enterPhoneNumber(phone);
    await this.page.locator('#recipient-phone-number:visible').first().click();
    await this.assertProductTitle();
  }

  /** Products → "Continue to payment" → payment-type step. */
  async topUpToPaymentType(): Promise<void> {
    const cont = this.page.locator('#continue:visible').first();
    await expect(cont).toBeEnabled({ timeout: 30_000 });
    await cont.click();
    const toPayment = this.page.getByRole('button', { name: /continue to payment/i });
    if (await toPayment.isVisible({ timeout: 5_000 }).catch(() => false)) await toPayment.click();
    await this.assertPaymentTypeStep();
  }

  // ── Payment type / card (shared) ───────────────────────────────────────────

  async assertPaymentTypeStep(): Promise<void> {
    await this.page.waitForURL(/payment/, { timeout: 45_000 });
    await expect(this.page.locator('#select-pay-type-continue:visible').first()).toBeVisible({ timeout: 30_000 });
  }

  walletOption(): Locator {
    return this.page.locator('#wallet-balance:visible').first();
  }

  debitOption(): Locator {
    return this.page.locator('#debit-card:visible').first();
  }

  async choosePayType(type: 'wallet' | 'debit'): Promise<void> {
    const option = type === 'wallet' ? this.walletOption() : this.debitOption();
    const next = this.page.locator('#select-pay-type-continue:visible').first();
    await expect(option).toBeVisible({ timeout: 30_000 });   // options replace a loading skeleton
    await expect(next).toBeEnabled({ timeout: 30_000 });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await option.click();
    await next.click();
  }

  /**
   * Debit card path → "Enter card details" → type an invalid card number → submit.
   * The payment step can re-render back to the method list while it reloads, so retry until the
   * card form holds our value.
   */
  async submitInvalidCard(cardNumber: string): Promise<void> {
    await expect(async () => {
      if (await this.debitOption().isVisible().catch(() => false)) await this.choosePayType('debit');
      await this.openAddCardForm();
      const input = this.cardNumberInput();
      await input.click();
      await input.fill('');
      await input.pressSequentially(cardNumber, { delay: 20 });
      await expect(input).not.toHaveValue('', { timeout: 3_000 });
      const btn = this.page.locator('#add-new-debit-card-btn:visible').first();
      await btn.scrollIntoViewIfNeeded();
      await btn.click({ timeout: 5_000 });
    }).toPass({ timeout: 90_000 });
  }

  cardNumberInput(): Locator {
    return this.page.locator('input[name="card_number"]:visible, input[placeholder^="e.g., 1233"]:visible').first();
  }

  /** From the debit-card step, get to the "add new card" form (skips the saved-cards list if shown). */
  async openAddCardForm(): Promise<void> {
    const addNew = this.page.getByRole('button', { name: /add (a )?new (debit )?card/i })
      .or(this.page.getByText(/add (a )?new (debit )?card/i)).first();
    await expect(this.cardNumberInput().or(addNew).first()).toBeVisible({ timeout: 30_000 });
    if (!(await this.cardNumberInput().isVisible().catch(() => false))) await addNew.click();
    await expect(this.cardNumberInput()).toBeVisible({ timeout: 15_000 });
  }

  // ── International bills ────────────────────────────────────────────────────

  /** Pick a bill category card (e.g. "VOIP") and continue to the provider step. */
  async billSelectUtility(label = ENV.DTONE_BILL_UTILITY): Promise<void> {
    const card = this.page.locator('[id^="utility-"]:visible').filter({ hasText: new RegExp(`^\\s*${label}\\s*$`, 'i') }).first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.click();
    await this.page.locator('#utility-continue:visible').first().click();
    await this.page.waitForURL(/international-bill\/providers/, { timeout: 30_000 });
  }

  async billToUtility(country = ENV.DTONE_BILL_PAYMENT_COUNTRY): Promise<void> {
    await this.openAndStart('international-bill');
    await this.selectCountry(country);
    await this.clickCountryContinue();
    await this.page.waitForURL(/international-bill\/utility/, { timeout: 30_000 });
    await expect(this.page.locator('#utility-title').first()).toBeVisible({ timeout: 30_000 });
  }

  // ── eSIM ───────────────────────────────────────────────────────────────────

  esimModeOption(mode: 'local' | 'regional' | 'global'): Locator {
    return this.page.locator(`#destination-mode-${mode}:visible`).first();
  }

  esimSearch(): Locator {
    return this.page.locator('input#search-destination:visible').first();
  }

  async esimToChooseDestination(mode: 'local' | 'regional' | 'global' = 'local'): Promise<void> {
    await this.openAndStart('e-sim');
    if (!(await this.esimSearch().isVisible().catch(() => false))) {
      await expect(this.esimModeOption(mode)).toBeVisible({ timeout: 30_000 });
      await this.esimModeOption(mode).click();
      await this.page.locator('#continue:visible').first().click();
    }
    await this.page.waitForURL(/e-sim\/destination\/choose-destination/, { timeout: 30_000 });
    await expect(this.esimSearch()).toBeVisible({ timeout: 30_000 });
  }

  async esimSearchDestination(text: string): Promise<void> {
    await this.esimSearch().fill(text);
    await this.page.waitForTimeout(800);
  }

  /** Search + click the first matching country → select-product. */
  async esimPickCountry(text: string): Promise<void> {
    await this.esimSearchDestination(text);
    const box = this.page.locator('[class*="rb-list-box"]:visible').first();
    await expect(box).toBeVisible({ timeout: 15_000 });
    await box.click();
    await this.page.waitForURL(/e-sim\/e-sim-details\/select-product/, { timeout: 30_000 });
    await expect(this.page.locator('#continue-button:visible').first()).toBeVisible({ timeout: 30_000 });
  }

  async esimToRecipientInfo(text: string): Promise<void> {
    await this.esimToChooseDestination();
    await this.esimPickCountry(text);
    await this.page.locator('#continue-button:visible').first().click();
    await this.page.waitForURL(/e-sim\/e-sim-details\/recipient-info/, { timeout: 30_000 });
    await expect(this.page.locator('input#email-input:visible').first()).toBeVisible({ timeout: 20_000 });
  }

  // ── Gift card ──────────────────────────────────────────────────────────────

  async giftToOrderDetails(country = ENV.DTONE_GIFT_CARD_COUNTRY): Promise<void> {
    await this.openAndStart('gift-card');
    await this.selectCountry(country);
    await this.clickCountryContinue();
    await this.page.waitForURL(/gift-card\/order-details/, { timeout: 30_000 });
    await expect(this.page.locator('input#email-input:visible').first()).toBeVisible({ timeout: 30_000 });
  }

  /** Order details → pick first gift card + email → purchase step (message box). */
  async giftToPurchase(email = ENV.PERSONAL_EMAIL): Promise<void> {
    await this.giftToOrderDetails();
    await this.page.locator('input#email-input:visible').first().fill(email);
    const card = this.page.locator('#image-container:visible').first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.click();
    await this.page.locator('#select-operator-continue:visible').first().click();
    await expect(this.page.locator('textarea#gift-text-area:visible').first()).toBeVisible({ timeout: 30_000 });
  }

  async giftToPaymentType(message?: string): Promise<void> {
    await this.giftToPurchase();
    if (message) await this.page.locator('textarea#gift-text-area:visible').first().fill(message);
    await this.page.locator('#continue-button:visible').first().click();
    await this.assertPaymentTypeStep();
  }

  // ── Misc ───────────────────────────────────────────────────────────────────

  async closeWizard(): Promise<void> {
    await this.page.locator('#close-icon:visible').first().click();
    await this.page.waitForURL(/dashboard/, { timeout: 30_000 });
  }

  /** Legacy helper used by older specs. */
  async clickContinue(): Promise<void> {
    await this.page.locator('#country-selection-continue:visible, #continue:visible, #continue-button:visible').first().click();
  }
}
