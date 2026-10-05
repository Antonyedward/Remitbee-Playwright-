import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

const AUTH_DIR = path.join(__dirname, 'playwright', '.auth');
const PERSONAL_AUTH = path.join(AUTH_DIR, 'personal.json');

// Only use storageState if the file already exists (i.e. flow:setup was run beforehand).
// When the file is absent tests still run — OTP is required as normal.
const storageState = fs.existsSync(PERSONAL_AUTH) ? PERSONAL_AUTH : undefined;

export default defineConfig({
  testDir: './tests/flows',
  testMatch: '**/*.flow.spec.ts',
  // Modules switched off (05 Oct 2026): Help and Currency converter are not configured properly on staging,
  // so these files are not loaded at all (not in regression, smoke or full runs).
  // To run them anyway: RUN_PARKED=true ./run.sh help   — or delete the two lines below to switch them back on.
  testIgnore: process.env.RUN_PARKED === 'true' ? [] : [
    '**/17-help.flow.spec.ts',
    '**/18-currency-converter.flow.spec.ts',
  ],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: process.env.PW_OUTPUT_DIR || './test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: process.env.PW_REPORT_DIR || 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://www.cp.wisecapitals.com',
    // Headed by default (visible browser). Run headless with HEADLESS=true,
    // e.g. `HEADLESS=true npm run flow:rates` or `npm run test:flow:headless`.
    headless: process.env.HEADLESS === 'true',
    viewport: { width: 1280, height: 800 },
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    // ── Auth setup — run ONCE manually before the first suite run ─────────────
    {
      name: 'setup',
      testDir: './playwright',
      testMatch: /auth\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
      },
    },

    // ── Main test project ─────────────────────────────────────────────────────
    // Always starts with a FRESH browser context (no storageState) so each test
    // does a full login with email + password — no stale cookies, no redirect surprises.
    {
      name: 'flow-chromium',
      use: {
        ...devices['Desktop Chrome'],
        // storageState intentionally omitted — always fresh browser, always full login
      },
    },
  ],
});
