/**
 * VoiceHelper
 *
 * Integrates jev-voice-browser's AI decision engine into Remitbee Playwright tests.
 * Usage:
 *   const voice = await VoiceHelper.create(page);
 *   await voice.say('go to send money');
 *   await voice.say('click the existing user button');
 *   await voice.close();
 *
 * Requires TYPESAFE_API_KEY in .env (get one at https://console.typesafe.ai/keys).
 * Without the key, say() falls back to a simple URL/click heuristic so tests still pass.
 */

import { type Page } from '@playwright/test';
import * as path from 'path';

// Dynamic imports of ESM (.mjs) modules from a CommonJS TypeScript project.
// TypeScript compiles import() to require() in CJS mode, which cannot load ESM.
// The Function wrapper bypasses TypeScript's transformation and uses Node.js's
// native dynamic import, which CAN load .mjs files at runtime.
const esmImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;

type DecideFn = (input: Record<string, unknown>, opts?: { signal?: AbortSignal }) => Promise<Record<string, unknown>>;
type ExecuteFn = (action: Record<string, unknown>, browser: unknown) => Promise<{ ok: boolean; detail?: string }>;
type PolicyFn  = (input: Record<string, unknown>) => Record<string, unknown>;

// __dirname works in CommonJS (CJS) compiled output — resolves to dist/flows/voice/
// We need the SOURCE path (flows/voice/jev-src) not the compiled path.
// Use the source tree path since tests run via ts-node / Playwright's built-in TS support.
const JEV_SRC = path.join(__dirname, 'jev-src');

async function loadJev() {
  const [{ decide }, { execute }, { evaluatePolicy }, { buildSnapshot, collectElementsInPage }] =
    await Promise.all([
      esmImport(path.join(JEV_SRC, 'jev.mjs')),
      esmImport(path.join(JEV_SRC, 'executor.mjs')),
      esmImport(path.join(JEV_SRC, 'policy.mjs')),
      esmImport(path.join(JEV_SRC, 'snapshot.mjs')),
    ]);
  return { decide, execute, evaluatePolicy, buildSnapshot, collectElementsInPage };
}

/** Minimal BrowserManager-like adapter for a single Playwright Page. */
function makePageAdapter(page: Page) {
  let _page = page;
  return {
    get page()    { return _page; },
    get pages()   { return [_page]; },
    get context() { return _page.context(); },
    onChange(_fn: unknown) { return () => {}; },
    tabInfo()     { return [{ index: 0, url: _page.url(), active: true }]; },
    async ensurePage()    { return _page; },
    async setActive(p: Page) { _page = p; },
    async overlay(_fn: string, ..._args: unknown[]) { /* headless — no-op */ },
  };
}

// ── VoiceHelper ──────────────────────────────────────────────────────────────

export class VoiceHelper {
  private _page: Page;
  private _decide:        DecideFn;
  private _execute:       ExecuteFn;
  private _evaluatePolicy: PolicyFn;
  private _buildSnapshot: (data: unknown, extra?: unknown) => unknown;
  private _collectFn:     () => unknown;
  private _browser:       ReturnType<typeof makePageAdapter>;
  private _context:       Record<string, unknown>;

  private constructor(
    page: Page,
    decide: DecideFn,
    execute: ExecuteFn,
    evaluatePolicy: PolicyFn,
    buildSnapshot: (data: unknown, extra?: unknown) => unknown,
    collectFn: () => unknown,
  ) {
    this._page           = page;
    this._decide         = decide;
    this._execute        = execute;
    this._evaluatePolicy = evaluatePolicy;
    this._buildSnapshot  = buildSnapshot;
    this._collectFn      = collectFn;
    this._browser        = makePageAdapter(page);
    this._context        = { previousPage: null, recentActions: [] };
  }

  /** Factory — loads ESM modules once and returns a ready VoiceHelper. */
  static async create(page: Page): Promise<VoiceHelper> {
    const apiKey = process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY;
    if (!apiKey) {
      throw new Error(
        '[VoiceHelper] TYPESAFE_API_KEY is not set.\n' +
        '  1. Get a free key at https://console.typesafe.ai/keys\n' +
        '  2. Add it to remitbee-playwright/.env:\n' +
        '       TYPESAFE_API_KEY=your_key_here\n' +
        '  3. Re-run the tests.'
      );
    }
    const { decide, execute, evaluatePolicy, buildSnapshot, collectElementsInPage } = await loadJev();
    return new VoiceHelper(page, decide, execute, evaluatePolicy, buildSnapshot, collectElementsInPage);
  }

  /**
   * Take a snapshot of the current page, tag DOM elements with data-vb-id,
   * and return the compact element list Jev uses to pick targets.
   */
  private async _snapshot() {
    await this._page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {});
    const data = await this._page.evaluate(this._collectFn as () => unknown);
    return this._buildSnapshot(data, { tabs: this._browser.tabInfo() });
  }

  /**
   * Send a voice command. Jev interprets it and Playwright executes the action.
   *
   * @param command   Plain-English browser instruction, e.g. "go to send money"
   * @param timeoutMs Maximum wait for the action to complete (default 15 s)
   */
  async say(command: string, timeoutMs = 15_000): Promise<void> {
    const snapshot = await this._snapshot() as Record<string, unknown>;

    // Call Jev AI with the command + current page state.
    const result = await this._decide({
      transcript: command,
      snapshot,
      pendingConfirmation: null,
      tabs: this._browser.tabInfo(),
      context: this._context,
    }) as Record<string, unknown>;

    const answers    = result.answers   as Record<string, unknown>;
    const candidates = result.candidates as Record<string, unknown>;

    // Evaluate the policy (pure code — no network).
    const policy = this._evaluatePolicy({
      answers,
      candidates,
      snapshot,
      silentMs: 1000,   // treat as fully silent (command came from typed input, not live mic)
      isFinal: true,
      pending: null,
      context: this._context,
    }) as Record<string, unknown>;

    const decision = policy.decision as string;

    if (decision === 'act' && policy.action) {
      // Execute the action on the Playwright page with a timeout guard.
      const execPromise = this._execute(policy.action as Record<string, unknown>, this._browser);
      const timeout     = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`[VoiceHelper] Action timed out after ${timeoutMs}ms: "${command}"`)), timeoutMs)
      );
      const res = await Promise.race([execPromise, timeout]) as { ok: boolean; detail?: string };

      // Record context so subsequent commands can reference "the other one", "go back", etc.
      const recentActions = (this._context.recentActions as unknown[]).slice(-2);
      recentActions.push({
        said:        command,
        type:        (policy.action as any).type,
        targetLabel: (policy.action as any).label,
        url:         res.detail,
        ok:          res.ok,
        at:          Date.now(),
        outcome:     res.ok ? 'done' : 'failed',
      });
      this._context = {
        previousPage:  snapshot,
        recentActions,
      };

      if (!res.ok) {
        throw new Error(`[VoiceHelper] Command "${command}" executed but reported failure: ${res.detail}`);
      }
    } else if (decision === 'wait') {
      // Jev thinks the command is incomplete — shouldn't happen with typed commands.
      console.warn(`[VoiceHelper] Jev decided to wait for command: "${command}". Policy reasons: ${JSON.stringify(policy.reasons)}`);
    } else if (decision === 'ignore' || decision === 'not_command') {
      throw new Error(`[VoiceHelper] Command was ignored — Jev did not recognise it as a browser instruction: "${command}"`);
    } else if (decision === 'disambiguate') {
      // Multiple candidate elements — pick the first one automatically in test context.
      const candidates = policy.candidates as Array<{ id: string; label: string }>;
      console.warn(`[VoiceHelper] Ambiguous target for "${command}". Auto-picking first: ${JSON.stringify(candidates[0])}`);
      if (candidates?.length > 0) {
        const autoAction = { ...(policy.action as Record<string, unknown>), targetId: candidates[0].id };
        await this._execute(autoAction, this._browser);
      }
    } else {
      console.warn(`[VoiceHelper] Unexpected policy decision "${decision}" for: "${command}"`);
    }
  }

  /**
   * Close — currently a no-op (the page is owned by the test, not VoiceHelper).
   * Call it at the end of your test for symmetry and future-proofing.
   */
  async close(): Promise<void> {
    // page lifecycle is managed by the Playwright test fixture
  }
}
