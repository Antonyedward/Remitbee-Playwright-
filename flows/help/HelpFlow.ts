import { Page, expect } from '@playwright/test';
import { FlowBase } from '../FlowBase';
import { ENV } from '../../config/environments';

export class HelpFlow extends FlowBase {
  constructor(page: Page) {
    super(page);
  }

  async navigateToHelp(): Promise<void> {
    await this.navigateSidebar('Help');
    await this.page.waitForURL(/help|support/i, { timeout: 15_000 });
    await this.dismissAllOverlays();
  }

  async assertHelpCenterVisible(): Promise<void> {
    const helpCenter = this.page
      .locator('[class*="help"], [class*="Help"]')
      .or(this.page.getByText(/help center|frequently asked|FAQ/i))
      .first();
    await helpCenter.waitFor({ state: 'visible' });
    await expect(helpCenter).toBeVisible();
  }

  async searchHelp(query: string): Promise<void> {
    // CP uses id="search-transactions" for the help search input (HelpSearchArticles.tsx)
    const input = this.page
      .locator('#search-transactions, input[type="search"], input[placeholder*="search" i]')
      .first();
    await input.waitFor({ state: 'visible' });
    await input.fill(query);
    await this.page.keyboard.press('Enter');
  }

  async assertSearchResults(): Promise<void> {
    const results = this.page
      .locator('[class*="result"], [class*="article"], [class*="Article"]')
      .first();
    await results.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(results).toBeVisible();
  }

  async clickContactSupport(): Promise<void> {
    await this.page
      .locator('button:has-text("Contact"), button:has-text("Chat"), a:has-text("Contact us")')
      .first()
      .click({ force: true });
  }

  async clickFAQItem(index: number = 0): Promise<void> {
    const items = this.page.locator('[class*="faq"], [class*="FAQ"], details, [class*="accordion"]');
    await items.nth(index).click();
  }

  async assertFAQExpanded(): Promise<void> {
    const expanded = this.page
      .locator('[class*="faq--open"], [class*="expanded"], details[open]')
      .first();
    await expanded.waitFor({ state: 'visible', timeout: 5_000 });
    await expect(expanded).toBeVisible();
  }

  // ── Live DOM (CP src/components/help/*, pages/customer-help/**) ─────────────
  // /customer-help: category cards [class*="rb-help-categories-card"] → /customer-help/<category>
  // category page: article rows [class*="rb-help-related-box"] → /customer-help/<category>/<article>
  // article page: breadcrumb "Help › <Category> › …", "Was this article helpful?" #yesResponseHelp/#noResponseHelp,
  //   Yes → "Thanks for your feedback!", No → #userResponseDialog with #submitResponse (disabled until a reason is picked),
  //   "Browse related articles" list. Footer: "Need more help?  Contact us" → /customer-help/contact-us.

  categoryCards() {
    return this.page.locator('[class*="rb-help-categories-card"]:visible');
  }

  articleRows() {
    return this.page.locator('[class*="rb-help-related-box"]:visible');
  }

  async openFirstCategory(): Promise<string> {
    await this.page.goto(`${ENV.BASE_URL}/customer-help`, { waitUntil: 'domcontentloaded' });
    await this.dismissAllOverlays();
    await expect(this.categoryCards().first()).toBeVisible({ timeout: 30_000 });
    const name = (await this.categoryCards().first().innerText()).split('\n')[0].trim();
    await expect(async () => {
      if (/customer-help\/?$/.test(new URL(this.page.url()).pathname)) await this.categoryCards().first().click();
      await this.page.waitForURL(/customer-help\/[^/?]+$/, { timeout: 8_000 });
    }).toPass({ timeout: 40_000 });
    return name;
  }

  async openFirstArticle(): Promise<void> {
    await this.openFirstCategory();
    await expect(this.articleRows().first()).toBeVisible({ timeout: 30_000 });
    await expect(async () => {
      if (!/customer-help\/[^/]+\/[^/?]+/.test(this.page.url())) await this.articleRows().first().click();
      await this.page.waitForURL(/customer-help\/[^/]+\/[^/?]+/, { timeout: 8_000 });
    }).toPass({ timeout: 40_000 });
    await expect(this.page.getByText(/was this article helpful\?/i).first()).toBeVisible({ timeout: 30_000 });
  }

  contactUsLink() {
    return this.page.getByText(/^contact us$/i).first();
  }

}
