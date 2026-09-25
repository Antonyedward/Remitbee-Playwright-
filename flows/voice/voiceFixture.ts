/**
 * voiceFixture
 *
 * Playwright fixture that adds a `voice` helper to every test that imports it.
 *
 * Usage in a test file:
 *
 *   import { test, expect } from '../../flows/voice/voiceFixture';
 *
 *   test('send money via voice', async ({ page, voice }) => {
 *     await page.goto('https://www.cp.wisecapitals.com');
 *     await voice.say('go to send money');
 *     await expect(page).toHaveURL(/send-money/);
 *   });
 *
 * The fixture creates one VoiceHelper per test (scoped to "test"),
 * and tears it down automatically when the test finishes.
 */

import { test as base, type Page } from '@playwright/test';
import { VoiceHelper } from './VoiceHelper';

// Extend the base Playwright fixtures with our `voice` fixture.
export type VoiceFixtures = {
  voice: VoiceHelper;
};

export const test = base.extend<VoiceFixtures>({
  voice: async ({ page }: { page: Page }, use: (r: VoiceHelper) => Promise<void>) => {
    const voice = await VoiceHelper.create(page);
    await use(voice);
    await voice.close();
  },
});

// Re-export expect so callers only need to import from this file.
export { expect } from '@playwright/test';
