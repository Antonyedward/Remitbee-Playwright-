/**
 * auth.setup.ts — Playwright Global Auth Setup
 *
 * Runs ONCE before the test suite. Logs in with "Remember this device" checked
 * so the CP server sets a long-lived device-trust cookie. Saves cookies to
 * playwright/.auth/personal.json and playwright/.auth/business.json.
 *
 * Tests that use storageState will start already authenticated — when loginForFlow()
 * navigates to /login, the server detects the device-trust cookie and redirects
 * straight to /dashboard, bypassing OTP entirely.
 *
 * Re-run this setup when:
 *   - Auth files are older than ~25 days (device trust lasts ~30 days)
 *   - Test accounts change password
 *   - "Remember this device" cookie is cleared
 *
 * How to run:
 *   npx playwright test --config=playwright.flow.config.ts --project=setup
 *
 * The setup runs in HEADED mode so you can complete OTP manually if the account
 * has not yet trusted this machine. Subsequent runs reuse the saved cookies.
 */

import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const AUTH_DIR = path.join(__dirname, '.auth');
const PERSONAL_AUTH = path.join(AUTH_DIR, 'personal.json');
const BUSINESS_AUTH = path.join(AUTH_DIR, 'business.json');
const RESTRICTED_AUTH = path.join(AUTH_DIR, 'restricted.json');

// Ensure .auth directory exists before any storageState write
fs.mkdirSync(AUTH_DIR, { recursive: true });
const BASE_URL = process.env.BASE_URL || 'https://www.cp.wisecapitals.com';

/** Check if a saved auth file is still fresh (< 25 days old). */
function isFresh(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  const ageMs = Date.now() - stat.mtimeMs;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays < 25;
}

async function loginAndSave(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  authFile: string,
): Promise<void> {
  const label = path.basename(authFile, '.json');

  if (isFresh(authFile)) {
    console.log(`\n✅ [${label}] Auth state is fresh (< 25 days old) — skipping re-login.\n`);
    return;
  }

  console.log(`\n🔑 [${label}] Auth state missing or stale. Logging in as ${email}…`);

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  // Fill email
  const emailInput = page.locator('#email, input[type="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 20_000 });
  await emailInput.fill(email);

  // Fill password
  const passwordInput = page.locator('#password, input[type="password"]').first();
  await passwordInput.fill(password);

  // ✅ Check "Remember this device" so the server sets a long-lived device-trust cookie.
  // This is what allows OTP to be skipped on subsequent logins from the same browser.
  const rememberCheckbox = page.locator('input[type="checkbox"], [class*="remember"]').first();
  const rememberVisible = await rememberCheckbox.isVisible().catch(() => false);
  if (rememberVisible) {
    const isChecked = await rememberCheckbox.isChecked().catch(() => false);
    if (!isChecked) await rememberCheckbox.check({ force: true });
    console.log('   ☑  "Remember this device" checkbox checked.');
  }

  // Submit
  await page.locator('#save-changes').first().click();

  // Wait for either dashboard (OTP skipped) or OTP screen
  console.log('   ⏳ Waiting for login outcome…');
  let outcome = '';
  try {
    await expect.poll(async () => {
      const url = new URL(page.url());
      if (/\/(dashboard|home)/.test(url.pathname)) return (outcome = 'dashboard');
      if (await page.locator('#code-1').isVisible()) return (outcome = 'otp');
      if (await page.locator('#message, #error-message').filter({ hasText: /\S/ }).first().isVisible()) return (outcome = 'error');
      return '';
    }, { timeout: 60_000, message: 'Waiting for dashboard or OTP screen' }).toMatch(/^(dashboard|otp|error)$/);
  } catch {
    throw new Error(`[${label}] Login timed out — page URL: ${page.url()}`);
  }

  if (outcome === 'error') {
    const errText = await page.locator('#message, #error-message').filter({ hasText: /\S/ }).first().innerText().catch(() => 'unknown error');
    throw new Error(`[${label}] Login failed: ${errText}`);
  }

  if (outcome === 'otp') {
    const otpSecret = process.env.ENTER_OTP || '';

    if (/^\d{6}$/.test(otpSecret)) {
      // Try the static code first
      console.log(`   📱 OTP screen detected. Trying static code: ${otpSecret}`);
      for (let i = 0; i < 6; i++) {
        await page.locator(`#code-${i + 1}`).fill(otpSecret[i]);
        await page.waitForTimeout(30);
      }
      // Login OTP: id='verify_code' (underscore) in VerificationCodeScreen.tsx
      // Signup/2FA OTP: id='verify-code' (dash) in 2FAVerification.tsx
      const verifyBtn = page.locator('#verify_code, #verify-code').first();
      await verifyBtn.waitFor({ state: 'visible', timeout: 10_000 });
      await verifyBtn.click({ force: true });

      // Wait briefly, then check if code was accepted or rejected
      await page.waitForTimeout(2_000);
      const stillOnOtp = await page.locator('#code-1').isVisible().catch(() => false);
      if (stillOnOtp) {
        // Static code rejected — clear boxes and fall through to manual entry
        console.log(`   ❌ Static code '${otpSecret}' was rejected by server.`);
        for (let i = 0; i < 6; i++) {
          await page.locator(`#code-${i + 1}`).fill('').catch(() => {});
        }
        console.log('\n⚠️  Please enter the REAL 6-digit SMS code in the browser window now.');
        console.log('   Waiting up to 90 seconds…\n');
      }
    } else {
      // No static code — prompt user to enter OTP manually (requires headed mode)
      console.log('\n⚠️  OTP required! Please enter the 6-digit code in the browser window.');
      console.log('   The setup will wait up to 90 seconds for you to complete it.\n');
    }

    // Wait for dashboard — either auto-OTP succeeded, or user typed the real code
    await page.waitForURL(/\/(dashboard|home)/, { timeout: 90_000 });
    console.log('   ✅ OTP completed — on dashboard!');
  }

  if (outcome === 'dashboard' || page.url().match(/\/(dashboard|home)/)) {
    console.log('   ✅ Logged in without OTP (device trusted).');
  }

  // Save cookies + localStorage to auth file
  await page.context().storageState({ path: authFile });
  console.log(`   💾 Auth state saved → ${authFile}\n`);
}

setup('Authenticate — personal account', async ({ page }) => {
  const email = process.env.PERSONAL_EMAIL || '';
  const password = process.env.USER_PASSWORD || '';
  if (!email || !password) throw new Error('PERSONAL_EMAIL / USER_PASSWORD not set in .env');
  await loginAndSave(page, email, password, PERSONAL_AUTH);
});

setup('Authenticate — business account', async ({ page }) => {
  const email = process.env.BUSINESS_EMAIL || '';
  const password = process.env.BUSINESS_PASSWORD || '';
  if (!email || !password) throw new Error('BUSINESS_EMAIL / BUSINESS_PASSWORD not set in .env');
  await loginAndSave(page, email, password, BUSINESS_AUTH);
});

setup('Authenticate — restricted account', async ({ page }) => {
  // PA-28 needs this account to be pre-authenticated to skip OTP.
  // Restricted accounts can log in but have limits — setup just saves the device-trust cookie.
  const email = process.env.RESTRICTED_EMAIL || '';
  const password = process.env.USER_PASSWORD || ''; // same password as personal by convention
  if (!email) throw new Error('RESTRICTED_EMAIL not set in .env');
  await loginAndSave(page, email, password, RESTRICTED_AUTH);
});
