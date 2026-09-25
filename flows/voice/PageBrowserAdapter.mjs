/**
 * PageBrowserAdapter
 *
 * Wraps an existing Playwright `Page` (already launched by the test framework)
 * into the interface that jev-src/executor.js and jev-src/controller.js expect
 * from a BrowserManager.
 *
 * Key differences from jev-voice-browser's BrowserManager:
 *  - No browser launch; adapts a page the caller already owns.
 *  - overlay() is a no-op (tests run headless; no visual feedback needed).
 *  - Tab management is minimal (single-page assumption for automation).
 *  - snapshot() tags DOM elements with data-vb-id via page.evaluate so
 *    executor.js can locate them with [data-vb-id="eNN"].
 */

import { collectElementsInPage, buildSnapshot } from "./jev-src/snapshot.mjs";

export class PageBrowserAdapter {
  /**
   * @param {import('playwright').Page} page  The test's Playwright page object.
   */
  constructor(page) {
    this._page = page;
    this._listeners = new Set();
  }

  // ── BrowserManager interface ──────────────────────────────────────────────

  /** The active page (sync property). */
  get page() {
    return this._page;
  }

  /** All managed pages (single-page adapter). */
  get pages() {
    return [this._page];
  }

  /** The Playwright BrowserContext, forwarded from the page. */
  get context() {
    return this._page.context();
  }

  /** Register a change listener (used by Controller for tab-change events). */
  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /** Returns the current page (async, matches BrowserManager.ensurePage()). */
  async ensurePage() {
    return this._page;
  }

  /**
   * Minimal tab info for the single page.
   * Controller sends this to Jev as `open_tabs` count context.
   */
  tabInfo() {
    return [{ index: 0, url: this._page.url(), active: true }];
  }

  /**
   * Take a snapshot of the page:
   *  - Runs collectElementsInPage() inside the browser to tag elements with
   *    data-vb-id attributes (required by executor.js's locatorFor()).
   *  - Returns the compact element list that Jev uses to pick targets.
   */
  async snapshot() {
    const page = this._page;
    try {
      await page.waitForLoadState("domcontentloaded", { timeout: 2000 }).catch(() => {});
      const data = await page.evaluate(collectElementsInPage);
      return buildSnapshot(data, { tabs: this.tabInfo() });
    } catch (err) {
      return buildSnapshot(
        { url: page.url(), title: "", scrollY: 0, scrollHeight: 0, viewportHeight: 0, elements: [] },
        { tabs: this.tabInfo(), error: String(err.message || err) }
      );
    }
  }

  /**
   * Visual overlay — no-op in headless test context.
   * (The real browser.js writes toast/highlight into the page via window.__vb.)
   */
  async overlay(_fn, ..._args) {
    // intentionally empty — tests are headless, no overlay script installed
  }

  /**
   * Set the active page. In the single-page adapter this is a no-op for
   * navigation within the same tab; for new-tab actions (executor open_new_tab)
   * we update the internal reference.
   */
  async setActive(page) {
    this._page = page;
    // Notify listeners (Controller uses this to refresh tab info).
    for (const fn of this._listeners) fn(this);
  }
}
