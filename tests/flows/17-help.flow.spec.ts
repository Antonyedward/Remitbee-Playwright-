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
  // Parked on request: staging help categories show no article rows yet — switch back to test(...) to re-enable
  test.fixme('HP-07 @regression — clicking a help category navigates to category articles', async ({ page }) => {
    await flow.loginForFlow();
    await flow.openFirstCategory();
    await expect(page).toHaveURL(/customer-help\/[^/?]+$/);
    await expect(flow.articleRows().first()).toBeVisible({ timeout: 20_000 });
  });

  // HP-08: Article page loads
  // Parked on request: staging help categories show no article rows yet — switch back to test(...) to re-enable
  test.fixme('HP-08 @regression — help article content loads', async ({ page }) => {
    await flow.loginForFlow();
    await flow.openFirstArticle();
    await expect(page).toHaveURL(/customer-help\/[^/]+\/[^/?]+/);
  });

  // HP-09: Feedback buttons on the article (HelpRelatedArticles.tsx)
  // Parked on request: staging help categories show no article rows yet — switch back to test(...) to re-enable
  test.fixme('HP-09 @regression — article feedback buttons "Yes" and "No" visible', async ({ page }) => {
    await flow.loginForFlow();
    await flow.openFirstArticle();
    await expect(page.locator('#yesResponseHelp')).toBeVisible();
    await expect(page.locator('#noResponseHelp')).toBeVisible();
  });

  // HP-10: "Yes" records the feedback inline (no dialog for Yes)
  // Parked on request: staging help categories show no article rows yet — switch back to test(...) to re-enable
  test.fixme('HP-10 @regression — clicking "Yes" feedback shows thanks message', async ({ page }) => {
    await flow.loginForFlow();
    await flow.openFirstArticle();
    await page.locator('#yesResponseHelp').click();
    await expect(page.getByText(/thanks for your feedback/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#yesResponseHelp')).toBeHidden();
  });

  // HP-11: "No" opens the reason dialog
  // Parked on request: staging help categories show no article rows yet — switch back to test(...) to re-enable
  test.fixme('HP-11 @regression — clicking "No" feedback opens userResponseDialog', async ({ page }) => {
    await flow.loginForFlow();
    await flow.openFirstArticle();
    await page.locator('#noResponseHelp').click();
    await expect(page.locator('#userResponseDialog')).toBeVisible({ timeout: 10_000 });
  });

  // HP-12: Feedback dialog submit button (disabled until a reason is chosen)
  // Parked on request: staging help categories show no article rows yet — switch back to test(...) to re-enable
  test.fixme('HP-12 @regression — feedback dialog has submit button', async ({ page }) => {
    await flow.loginForFlow();
    await flow.openFirstArticle();
    await page.locator('#noResponseHelp').click();
    const submit = page.locator('#submitResponse');
    await expect(submit).toBeVisible({ timeout: 10_000 });
    await expect(submit).toBeDisabled();
  });

  // HP-13: Breadcrumb "Help › <Category> › …" on the article page
  // Parked on request: staging help categories show no article rows yet — switch back to test(...) to re-enable
  test.fixme('HP-13 @regression — breadcrumb navigation visible on help article', async ({ page }) => {
    await flow.loginForFlow();
    await flow.openFirstArticle();
    const helpCrumb = page.getByText(/^help$/i).first();
    await expect(helpCrumb).toBeVisible();
    await helpCrumb.click();
    await page.waitForURL(/customer-help\/?$/, { timeout: 20_000 });
  });

  // HP-14: Related articles list on the article page
  // Parked on request: staging help categories show no article rows yet — switch back to test(...) to re-enable
  test.fixme('HP-14 @regression — related articles section visible on article page', async ({ page }) => {
    await flow.loginForFlow();
    await flow.openFirstArticle();
    await expect(page.getByText(/browse related articles/i).first()).toBeVisible();
    expect(await flow.articleRows().count()).toBeGreaterThan(0);
  });

  // HP-15: "Need more help? Contact us" (MoreHelp.tsx) → contact page
  test('HP-15 @regression — contact support option visible on help page', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToHelp();
    await expect(page.getByText(/need more help\?/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(flow.contactUsLink()).toBeVisible();
    await flow.contactUsLink().click();
    await page.waitForURL(/customer-help\/contact-us/, { timeout: 20_000 });
  });

  test('HP-16 @smoke @regression — help page has correct URL', async ({ page }) => {
    await flow.loginForFlow();
    await flow.navigateToHelp();
    await expect(page).toHaveURL(/help|support/i);
  });
});
