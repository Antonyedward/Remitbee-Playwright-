import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';

/**
 * Send-money wizard helper. Selectors verified against remitbee-cp source
 * (src/components/sendMoneyV2/**).
 *
 * Step order (SendMoneyWizard.tsx):
 *   - account WITH recipients : recipient list → transfer (converter) → purpose → [sender] → payment → overview
 *   - first transfer, no recipient: transfer (country → converter) → recipient → ... (AddCountry comes first)
 */
export class SendMoneyFlow extends FlowBase {
  /** Landmarks that prove the send-money wizard has rendered a real step (not a skeleton). */
  // :visible on each so .first() can't lock onto a hidden match (the wizard animates between steps).
  static readonly WIZARD_LANDMARKS =
    ['#select-recipient', '#send-money-recipientList', 'button#send-money-country-selection',
     '#send-money-addCountry', '#send-money-transfer-details', '#send-money-coverter-box']
      .map(s => `${s}:visible`).join(', ');

  constructor(page: Page) {
    super(page);
  }

  async navigateToSendMoney(): Promise<void> {
    await this.navigateSidebar('Send');
    await this.page.waitForURL(/money-transfer/i, { timeout: 15_000 });
    await this.dismissAllOverlays();

    // Some accounts (seen live on the Level 4 account) open on a splash screen first:
    // "Send money with RemitBee" + button "Start sending money" (send-money.json splash.action).
    const landmark = this.page.locator(SendMoneyFlow.WIZARD_LANDMARKS).first();
    const startBtn = this.page.getByRole('button', { name: /start sending money/i });
    // 40s: accounts with very long recipient lists (seen live on PERSONAL_EMAIL) render slowly.
    await landmark.or(startBtn).first().waitFor({ state: 'visible', timeout: 40_000 });
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
    }
    await landmark.waitFor({ state: 'visible', timeout: 40_000 });
  }

  // ── Step: recipient / country ────────────────────────────────────────────────

  /** First-time flow: AddCountry.tsx — dropdown #send-money-country-selection, Continue button #send-money-addCountry. */
  async selectRecipientCountry(country: string): Promise<void> {
    // DropDownField.tsx renders the SAME id on a container <div> (has the onClick toggle) and an
    // inner <button>. Target the button: its click bubbles to the div's handler and opens the list.
    const field = this.page.locator('button#send-money-country-selection');
    await field.waitFor({ state: 'visible', timeout: 15_000 });

    await expect(async () => {
      if (!(await field.textContent() ?? '').match(new RegExp(country, 'i'))) {
        // Open the list if it isn't open yet. DropDownList renders the search box as input#search
        // (a sibling of the field, NOT inside #send-money-country-selection).
        const search = this.page.locator('input#search');
        if (!(await search.isVisible().catch(() => false))) await field.click();
        await search.waitFor({ state: 'visible', timeout: 5_000 });
        await search.fill(country);

        // Options are DropDownItem <li data-item='{...}'> elements.
        const option = this.page.locator('li[data-item]:visible')
          .filter({ hasText: new RegExp(`^\\s*${country}\\b`, 'i') })
          .first();
        await option.click({ timeout: 5_000 });
      }
      // Verify the field now shows the chosen country before moving on.
      await expect(field).toContainText(new RegExp(country, 'i'), { timeout: 3_000 });
    }).toPass({ timeout: 30_000, intervals: [500, 1_000, 2_000] });

    // #send-money-addCountry is the step's CONTINUE button, not the dropdown.
    await this.page.locator('#send-money-addCountry').click();
  }

  /** Recipient list: RecipientLists.tsx → #send-money-recipientList > item (onClick on the item container). */
  async selectFirstRecipient(): Promise<void> {
    const items = this.page.locator('#send-money-recipientList > div')
      .filter({ hasNotText: /country unavailable|not available/i });
    await items.first().waitFor({ state: 'visible', timeout: 15_000 });
    await items.first().click({ force: true });
  }

  async selectRecipient(name: string): Promise<void> {
    const item = this.page.locator('#send-money-recipientList > div').filter({ hasText: name }).first();
    await item.waitFor({ state: 'visible', timeout: 15_000 });
    await item.click({ force: true });
  }

  /**
   * Get to the converter (#send-money-coverter-box) from whichever step the wizard opened on.
   * Existing users open on the recipient list; first-time users open on AddCountry.
   */
  async ensureOnConverter(country = 'India'): Promise<void> {
    const converter = this.page.locator('#send-money-coverter-box');
    if (await converter.isVisible().catch(() => false)) return;

    const recipientList = this.page.locator('#send-money-recipientList');
    // DropDownField puts id="send-money-country-selection" on BOTH a div and a button — an
    // unqualified locator throws a strict-mode violation (seen in the SM-11 trace), which
    // isVisible().catch() silently turned into "false". Target the button only.
    const countryStep = this.page.locator('button#send-money-country-selection');
    await recipientList.or(countryStep).or(converter).first()
      .waitFor({ state: 'visible', timeout: 20_000 });

    if (await recipientList.isVisible().catch(() => false)) {
      await this.selectFirstRecipient();
    } else if (await countryStep.isVisible().catch(() => false)) {
      await this.selectRecipientCountry(country);
    }
    await converter.waitFor({ state: 'visible', timeout: 25_000 });
  }

  /** RecipientLists.tsx id="send-money-addRecipient" (only rendered when the account has recipients). */
  async clickAddNewRecipient(): Promise<void> {
    await this.page.locator('#send-money-addRecipient').click({ force: true });
  }

  async selectTransferMethod(method: string): Promise<void> {
    await this.page
      .locator('button, [role="radio"], [class*="option"]')
      .filter({ hasText: new RegExp(method, 'i') })
      .first()
      .click({ force: true });
  }

  // ── Step: transfer details (converter) ───────────────────────────────────────

  /** MoneyTransferBox → CurrencyInputField renders the send input as id="sendingEnd". */
  async enterSendAmount(amount: string): Promise<void> {
    await this.ensureOnConverter();
    const input = this.page.locator('#send-money-coverter-box #sendingEnd').first();
    await input.waitFor({ state: 'visible', timeout: 10_000 });
    await input.click({ clickCount: 3 });
    await input.fill(amount);
    // Rate recalculation: the box shows #loading while the conversion API runs.
    await this.page.locator('#send-money-coverter-box #loading').first()
      .waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    await this.page.waitForTimeout(500); // debounce before Continue reads the value
  }

  async clickContinue(): Promise<void> {
    // Converter: id="continue". Purpose: id="purpose-selection-continue". Payment: id="payment-type-continue".
    const btn = this.page
      .locator('#continue:visible, #purpose-selection-continue:visible, #payment-type-continue:visible')
      .first();
    await btn.waitFor({ state: 'visible', timeout: 15_000 });
    await btn.click({ force: true });
  }

  /**
   * Click the converter's Continue (id="continue") until the wizard leaves the converter.
   *
   * Live DOM showed the click being swallowed: handleContinueFromConversion() silently returns while
   * `loading || sendingAmountLoading || receivingAmountLoading` is true (rate recalculation after
   * typing). So: wait for the receive amount to be populated and the button enabled, click normally
   * (no force — actionability must pass), and re-click if the step hasn't changed.
   */
  async continueFromConverter(): Promise<void> {
    const converter = this.page.locator('#send-money-coverter-box');
    const receive = converter.locator('#receivingEnd');
    const continueBtn = this.page.locator('#continue');
    // Where Continue leads depends on the account (Jam 86de7988: a first-time user goes to
    // /money-transfer/recipient/add-receiving-method; existing users go to /transfer/purpose or
    // /payment). So success = the URL has left /transfer/conversion.
    const onConverter = () => /\/money-transfer\/transfer\/conversion/.test(new URL(this.page.url()).pathname);

    await expect(receive).not.toHaveValue(/^(0(\.0+)?)?$/, { timeout: 15_000 });

    // Jam 86de7988 shows the first Continue click routinely being swallowed (had to click twice).
    await expect(async () => {
      if (!onConverter()) return;
      await this.dismissExtraAmountDialog();
      await expect(continueBtn).toBeEnabled({ timeout: 5_000 });
      await continueBtn.click();
      await this.dismissExtraAmountDialog();
      await expect.poll(onConverter, { timeout: 8_000 }).toBe(false);
    }).toPass({ timeout: 45_000, intervals: [1_000, 2_000, 3_000] });
  }

  /**
   * Min-amount check (SM-16). The $10 CAD message ("Minimum sending amount is $10 CAD", under the
   * input) only appears after Continue is processed — and the first click is often swallowed
   * (Jam 86de7988: needed a second click at $5). Retry Continue until the message shows.
   */
  async triggerMinimumAmountError(): Promise<void> {
    const continueBtn = this.page.locator('#continue');
    const minError = this.page.getByText(/minimum sending amount is|less than the minimum limit/i).first();
    await expect(async () => {
      if (await minError.isVisible().catch(() => false)) return;
      if (await continueBtn.isEnabled().catch(() => false)) await continueBtn.click();
      await expect(minError).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 30_000, intervals: [1_000, 2_000] });
  }

  /** Converter → purpose → payment. Stops at the payment-type step (#select-payment-method). */
  async goToPaymentStep(amount: string): Promise<void> {
    await this.enterSendAmount(amount);
    await this.continueFromConverter();

    const purpose = this.page.locator('#purpose-selection');
    const payment = this.page.locator('#select-payment-method');
    await purpose.or(payment).first().waitFor({ state: 'visible', timeout: 25_000 });

    if (await purpose.isVisible().catch(() => false)) {
      await this.selectFirstPurpose();
      await this.page.locator('#purpose-selection-continue').click();
    }
    await payment.waitFor({ state: 'visible', timeout: 25_000 });
  }

  /**
   * PurposeDropDown.tsx → DropDown id="send-money-purpose-selection" (same id on container div +
   * inner button, see DropDownField.tsx). Options are <li data-item> in the list.
   * The purpose may already be pre-selected from a previous transfer — skip if so.
   */
  async selectFirstPurpose(): Promise<void> {
    const field = this.page.locator('button#send-money-purpose-selection');
    await field.waitFor({ state: 'visible', timeout: 15_000 });
    const placeholderShown = await field.getByText(/select purpose/i).isVisible().catch(() => false);
    if (!placeholderShown) return;

    await expect(async () => {
      if (!(await this.page.locator('li[data-item]:visible').first().isVisible().catch(() => false))) {
        await field.click();
      }
      await this.page.locator('li[data-item]:visible').first().click({ timeout: 5_000 });
      await expect(field.getByText(/select purpose/i)).toBeHidden({ timeout: 3_000 });
    }).toPass({ timeout: 20_000, intervals: [500, 1_000, 2_000] });
  }

  // ── Step: payment ────────────────────────────────────────────────────────────

  /** SelectPayType.tsx — options are Radio components labelled e.g. "CAD Balance", "Debit card", "e-Transfer". */
  async selectPaymentMethod(method: string | RegExp): Promise<void> {
    const label = typeof method === 'string' ? new RegExp(method, 'i') : method;
    await this.page.getByText(label).first().click({ force: true });
  }

  paymentOption(method: string | RegExp) {
    const label = typeof method === 'string' ? new RegExp(method, 'i') : method;
    return this.page.getByText(label).first();
  }

  async clickConfirm(): Promise<void> {
    await this.page.locator('#create-transaction').click({ force: true });
  }

  // ── Assertions ───────────────────────────────────────────────────────────────

  async assertOrderConfirmation(): Promise<void> {
    await this.page.locator('#transfer-summary, #recipient-summary')
      .or(this.page.getByText(/transfer submitted|order placed|success/i))
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 });
  }

  /** "Send money page loaded": any real wizard step is showing (converter for existing flows). */
  async assertTransferRate(): Promise<void> {
    const landmark = this.page.locator(SendMoneyFlow.WIZARD_LANDMARKS).first();
    await expect(landmark).toBeVisible({ timeout: 20_000 });
  }

  /** Fee is only rendered on the payment step (SelectPayType.tsx id="total-fees"). */
  async assertFee(): Promise<void> {
    await expect(this.page.locator('#total-fees').first()).toBeVisible({ timeout: 15_000 });
  }

  async assertComplianceNotification(): Promise<void> {
    await expect(this.page.locator('#transfer-detail-compliance-notification').first())
      .toBeVisible({ timeout: 15_000 });
  }

  async dismissExtraAmountDialog(): Promise<void> {
    const dialog = this.page.locator('#extra-amount-dialog');
    const visible = await dialog.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false);
    if (visible) {
      await this.page.locator('#got-it').click({ force: true });
      await dialog.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
    }
  }

  /**
   * Two minimum checks exist:
   *  - send side (click Continue):  #errorMessage "Minimum sending amount is $10 CAD"
   *  - receive side (live, Continue disabled): "Receiving amount is less than the minimum limit …"
   * Which one fires first depends on the recipient's corridor, so accept either.
   */
  async assertMinimumAmountError(): Promise<void> {
    await expect(
      this.page.getByText(/minimum sending amount is|less than the minimum limit/i).first()
    ).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Limit errors come from useTransferValidation → complianceError, rendered live (while typing) in
   * #transfer-detail-compliance-notification. One variant ("…additional documents…") has no "limit" word.
   */
  async assertMaximumAmountError(): Promise<void> {
    await expect(this.page.locator('#transfer-detail-compliance-notification').first())
      .toContainText(/limit|exceed|maximum|additional documents/i, { timeout: 15_000 });
  }
}
