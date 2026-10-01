/**
 * 19-voice — Voice-Commanded Flow Tests (powered by Jev AI)
 *
 * These tests drive the Remitbee CP using plain-English commands instead of
 * hard-coded selectors. Each `voice.say(...)` call:
 *   1. Snapshots the live DOM (tags every interactive element with data-vb-id)
 *   2. Sends the command + page context to the Jev AI (TypeSafe API)
 *   3. Evaluates Jev's decision locally (policy.mjs)
 *   4. Executes the resulting Playwright action (click / navigate / type / etc.)
 *
 * Prerequisites (run once before this spec):
 *   cd remitbee-playwright
 *   npm install              ← installs @typesafe-ai/sdk
 *   # set TYPESAFE_API_KEY= in .env (https://console.typesafe.ai/keys)
 *
 * Run:
 *   npx playwright test --config=playwright.flow.config.ts tests/flows/19-voice.flow.spec.ts
 */

import { expect } from '@playwright/test';
import { test }   from '../../flows/voice/voiceFixture';
import * as dotenv from 'dotenv';
dotenv.config();
import { ENV } from '../../config/environments';
import { FlowBase } from '../../flows/FlowBase';

const BASE_URL = process.env.BASE_URL ?? 'https://www.cp.wisecapitals.com';
const EMAIL    = process.env.PERSONAL_EMAIL ?? '';
const PASSWORD = ENV.USER_PASSWORD; // shared test-account password (config/environments.ts)

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Navigate to the CP login page and sign in using voice commands. */
async function voiceLogin(page: import('@playwright/test').Page, voice: import('../../flows/voice/VoiceHelper').VoiceHelper) {
  await page.goto(`${BASE_URL}/login`);
  await new FlowBase(page).dismissCookies(); // cookie banner covers the code screen's Verify button

  await voice.say(`type "${EMAIL}" into the email field`);
  await voice.say(`type "${PASSWORD}" into the password field`);
  await voice.say('click the sign in button');

  // Wait for post-login redirect (OTP page or dashboard)
  // Post-login redirect: dashboard, or the 2-step code page (/login?step=login-2fa)
  await page.waitForURL(/\/dashboard|\/otp|\/two-factor|login-2fa/, { timeout: 30_000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Voice-commanded flows @voice', () => {

  // Send money / Rates are app pages — log in normally first, then drive navigation by voice
  test('navigate to the Send Money page using a voice command', async ({ page, voice }) => {
    await new FlowBase(page).loginForFlow();
    await voice.say('go to send money');
    await expect(page).toHaveURL(/send-money|sendmoney|money-transfer/i, { timeout: 20_000 }); // CP send-money wizard lives at /money-transfer/...
  });

  test('navigate to Rates page using a voice command', async ({ page, voice }) => {
    await new FlowBase(page).loginForFlow();
    await voice.say('open the rates page');
    await expect(page).toHaveURL(/rates/i, { timeout: 20_000 });
  });

  test('fill the login form using voice commands', async ({ page, voice }) => {
    await page.goto(`${BASE_URL}/login`);

    await voice.say(`type "${EMAIL}" into the email field`);
    // Email input should now contain the value
    const emailVal = await page.inputValue('#email').catch(() => '');
    expect(emailVal).toBe(EMAIL);

    await voice.say(`type "${PASSWORD}" into the password field`);
    const passVal = await page.inputValue('#password').catch(() => '');
    expect(passVal.length).toBeGreaterThan(0);
  });

  test('full sign-in flow using only voice commands', async ({ page, voice }) => {
    await voiceLogin(page, voice);

    // After OTP (if any) — navigate to Send Money via voice
    // 2-step code page: the code is a fixed staging OTP — enter it directly (6 boxes), then continue by voice
    if (/otp|two-factor|login-2fa/.test(page.url())) {
      const otp = ENV.ENTER_OTP;
      // Same as FlowBase.loginForFlow: fill each box with a short pause so React registers every digit,
      // then press Verify only if the app didn't auto-submit (button still enabled).
      for (let i = 0; i < otp.length; i++) {
        await page.locator(`#code-${i + 1}`).fill(otp[i]);
        await page.waitForTimeout(60);
      }
      const verify = page.locator('#verify_code, #verify-code').first();
      const auto = await page.waitForURL(/dashboard/, { timeout: 5_000 }).then(() => true).catch(() => false);
      if (!auto && await verify.isEnabled().catch(() => false)) await verify.click();
      await page.waitForURL(/dashboard/, { timeout: 45_000 });
      await new FlowBase(page).dismissAllOverlays().catch(() => {});
    }

    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });

    // Navigate to a feature using voice
    await voice.say('go to recipients');
    await expect(page).toHaveURL(/recipients/i, { timeout: 10_000 });
  });

  test('scroll down on the current page using a voice command', async ({ page, voice }) => {
    // Long public page that scrolls the window (logged-out /rates redirects to the short login page)
    await page.goto(`${BASE_URL}/currency-converter`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { level: 1, name: /currency converter/i }).waitFor({ timeout: 30_000 });
    const beforeY = await page.evaluate(() => (globalThis as any).scrollY as number);
    await voice.say('scroll down');
    await page.waitForTimeout(1_000); // smooth scroll
    const afterY = await page.evaluate(() => (globalThis as any).scrollY as number);
    expect(afterY).toBeGreaterThan(beforeY);
  });

});
