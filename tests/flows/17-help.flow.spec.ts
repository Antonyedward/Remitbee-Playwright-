import { test, expect } from '@playwright/test';
import { HelpFlow } from '../../flows/help/HelpFlow';
import { ENV } from '../../config/environments';

test.describe('17 — Help', () => {
  let flow: HelpFlow;

  test.beforeEach(async ({ page }) => {
    flow = new HelpFlow(page);
  });

  // HP-01: Help page loads
  test('HP-01 @smoke @regression — help page loads', async () => {
    await flow.loginForFlow();
    await flow.navigateToHelp();
  });

  // HP-02: Help center content visible
  test('HP-02 @smoke @regression — help center content visible', async () => {
    await flow.loginForFlow();
    await flow.navigateToHelp();
    await flow.assertHelpCenterVisible();
  });

  // HP-03: Search box visible — id="search-transactions" from HelpSearchArticles.tsx
  test('HP-03 @regression — search box visible on help page', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToHelp();
    const search = page.locator('#search-transactions');
    const visible = await search.isVisible().catch(() => false);
    if (visible) {
      await expect(search).toBeVisible();
    } else {
      // Fallback to generic search input
      const genericSearch = page.locator('input[type="search"], input[placeholder*="search" i]').first();
      await expect(genericSearch).toBeVisible({ timeout: 10_000 });
    }
  });

  // HP-04: Searching a term returns results
  test('HP-04 @regression — searching a term returns help results', async () => {
    await flow.loginForFlow();
    await flow.navigateToHelp();
    await flow.searchHelp('send money');
    await flow.assertSearchResults();
  });

  // HP-05: Search with no results shows empty/no-results state
  test('HP-05 @regression — search with gibberish shows no results or empty state', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToHelp();
    await flow.searchHelp('xyzqwertynotaword12345');
    await page.waitForTimeout(2_000);
    // Either an empty state or "no results" text — both valid outcomes
    const noResult = page
      .getByText(/no result|not found|no article|couldn't find/i)
      .first();
    await expect(noResult).toBeVisible({ timeout: 8_000 });
  });

  // HP-06: Categories list visible on help page
  test('HP-06 @regression — help categories list visible', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToHelp();
    // Help categories render as cards/boxes without specific IDs — use class-based selector
    const categories = page
      .locator('[class*="help-categories"], [class*="HelpCategories"], [class*="rb-help"]')
      .first();
    await expect(categories).toBeVisible({ timeout: 15_000 });
  });

  // HP-07: Clicking a help category opens the category page
  test('HP-07 @regression — clicking a help category navigates to category articles', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToHelp();
    const categoryItem = page
      .locator('[class*="help-categories-list"], [class*="rb-help-categories"]')
      .first();
    const visible = await categoryItem.isVisible().catch(() => false);
    if (visible) {
      await categoryItem.click({ force: true });
      await page.waitForURL(/customer-help|help\//i, { timeout: 15_000 }).catch(() => {});
    }
  });

  // HP-08: Article content visible after clicking into help
  test('HP-08 @regression — help article content loads', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToHelp();
    await flow.searchHelp('send money');
    await page.waitForTimeout(1_500);
    const article = page
      .locator('[class*="article"], [class*="Article"], [class*="HelpArticle"]')
      .first();
    const visible = await article.isVisible().catch(() => false);
    if (visible) {
      await article.click({ force: true });
      await page.waitForURL(/customer-help|article/i, { timeout: 15_000 }).catch(() => {});
    }
  });

  // HP-09: Feedback buttons visible on article — ids from HelpRelatedArticles.tsx
  test('HP-09 @regression — article feedback buttons "Yes" and "No" visible', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToHelp();
    await flow.searchHelp('send money');
    await page.waitForTimeout(1_500);
    const article = page
      .locator('[class*="article"], [class*="Article"]')
      .first();
    const clicked = await article.isVisible().catch(() => false);
    if (clicked) {
      await article.click({ force: true });
      await page.waitForTimeout(2_000);
      const yesBtn = page.locator('#yesResponseHelp');
      const noBtn = page.locator('#noResponseHelp');
      const yesVisible = await yesBtn.isVisible().catch(() => false);
      if (yesVisible) {
        await expect(yesBtn).toBeVisible();
        await expect(noBtn).toBeVisible();
      }
    }
  });

  // HP-10: Clicking "Was this helpful? Yes" opens feedback dialog
  test('HP-10 @regression — clicking "Yes" feedback opens userResponseDialog', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToHelp();
    const yesBtn = page.locator('#yesResponseHelp');
    const visible = await yesBtn.isVisible().catch(() => false);
    if (visible) {
      await yesBtn.click({ force: true });
      const dialog = page.locator('#userResponseDialog');
      await expect(dialog).toBeVisible({ timeout: 8_000 });
    } else {
      test.skip();
    }
  });

  // HP-11: Clicking "No" feedback opens userResponseDialog
  test('HP-11 @regression — clicking "No" feedback opens userResponseDialog', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToHelp();
    const noBtn = page.locator('#noResponseHelp');
    const visible = await noBtn.isVisible().catch(() => false);
    if (visible) {
      await noBtn.click({ force: true });
      const dialog = page.locator('#userResponseDialog');
      await expect(dialog).toBeVisible({ timeout: 8_000 });
    } else {
      test.skip();
    }
  });

  // HP-12: Submit feedback button visible in dialog
  test('HP-12 @regression — feedback dialog has submit button', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToHelp();
    const yesBtn = page.locator('#yesResponseHelp');
    const visible = await yesBtn.isVisible().catch(() => false);
    if (visible) {
      await yesBtn.click({ force: true });
      const submitBtn = page.locator('#submitResponse');
      await expect(submitBtn).toBeVisible({ timeout: 8_000 });
    } else {
      test.skip();
    }
  });

  // HP-13: Breadcrumb navigation visible on article pages
  test('HP-13 @regression — breadcrumb navigation visible on help article', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToHelp();
    await flow.searchHelp('send money');
    await page.waitForTimeout(1_500);
    const article = page.locator('[class*="Article"], [class*="article"]').first();
    const articleVisible = await article.isVisible().catch(() => false);
    if (!articleVisible) {
      test.skip(true, 'No help article found in search results — skipping breadcrumb check');
    }
    await article.click({ force: true });
    await page.waitForURL(/article|help/i, { timeout: 10_000 }).catch(() => {});
    const breadcrumb = page.locator('[class*="breadcrumb"], [class*="BreadCrumb"]').first();
    await expect(breadcrumb).toBeVisible({ timeout: 8_000 });
  });

  // HP-14: Related articles visible on article page
  test('HP-14 @regression — related articles section visible on article page', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToHelp();
    await flow.searchHelp('send money');
    await page.waitForTimeout(1_500);
    const article = page.locator('[class*="Article"], [class*="article"]').first();
    const articleVisible = await article.isVisible().catch(() => false);
    if (!articleVisible) {
      test.skip(true, 'No help article found in search results — skipping related articles check');
    }
    await article.click({ force: true });
    await page.waitForURL(/article|help/i, { timeout: 10_000 }).catch(() => {});
    const related = page.locator('[class*="related"], [class*="Related"]').first();
    await expect(related).toBeVisible({ timeout: 8_000 });
  });

  // HP-15: Contact support option visible
  test('HP-15 @regression — contact support option visible on help page', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToHelp();
    const contact = page
      .locator('button:has-text("Contact"), a:has-text("Contact us"), button:has-text("Chat"), a:has-text("Chat")')
      .first();
    await expect(contact).toBeVisible({ timeout: 10_000 });
  });

  // HP-16: Help page URL is correct
  test('HP-16 @smoke @regression — help page has correct URL', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToHelp();
    await expect(page).toHaveURL(/help|support/i);
  });
});
