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

const BASE_URL = process.env.BASE_URL ?? 'https://www.cp.wisecapitals.com';
const EMAIL    = process.env.PERSONAL_EMAIL ?? '';
const PASSWORD = ENV.USER_PASSWORD; // shared test-account password (config/environments.ts)

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Navigate to the CP login page and sign in using voice commands. */
async function voiceLogin(page: import('@playwright/test').Page, voice: import('../../flows/voice/VoiceHelper').VoiceHelper) {
  await page.goto(`${BASE_URL}/login`);

  await voice.say(`type "${EMAIL}" into the email field`);
  await voice.say(`type "${PASSWORD}" into the password field`);
  await voice.say('click the sign in button');

  // Wait for post-login redirect (OTP page or dashboard)
  await page.waitForURL(/\/dashboard|\/otp|\/two-factor/, { timeout: 15_000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Voice-commanded flows @voice', () => {

  test('navigate to the Send Money page using a voice command', async ({ page, voice }) => {
    await page.goto(BASE_URL);
    await voice.say('go to send money');
    await expect(page).toHaveURL(/send-money|sendmoney/i, { timeout: 10_000 });
  });

  test('navigate to Rates page using a voice command', async ({ page, voice }) => {
    await page.goto(BASE_URL);
    await voice.say('open the rates page');
    await expect(page).toHaveURL(/rates/i, { timeout: 10_000 });
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
    const url = page.url();
    if (/otp|two-factor/.test(url)) {
      // OTP is manual; skip for now — just confirm we reached auth flow
      console.log('[voice test] OTP page reached — skipping OTP entry in voice demo');
      return;
    }

    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });

    // Navigate to a feature using voice
    await voice.say('go to recipients');
    await expect(page).toHaveURL(/recipients/i, { timeout: 10_000 });
  });

  test('scroll down on the current page using a voice command', async ({ page, voice }) => {
    await page.goto(`${BASE_URL}/rates`);
    const beforeY = await page.evaluate(() => (globalThis as any).scrollY as number);
    await voice.say('scroll down');
    await page.waitForTimeout(600);
    const afterY = await page.evaluate(() => (globalThis as any).scrollY as number);
    expect(afterY).toBeGreaterThan(beforeY);
  });

});
