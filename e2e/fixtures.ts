import { test as base, expect, type Page } from '@playwright/test';

/** Monday 26 October 2026, 09:00 in Paris (after the DST change of 25 October). */
export const START = new Date('2026-10-26T09:00:00+01:00');

interface Diagnostics {
  errors: string[];
  failedRequests: string[];
  externalRequests: string[];
}

/**
 * Every test automatically fails on uncaught exceptions, console errors/warnings, failed or
 * 4xx/5xx requests, and any request leaving localhost (the app must work fully offline).
 */
export const test = base.extend<{ diagnostics: Diagnostics; allowConsole: RegExp[] }>({
  allowConsole: [[], { option: true }],
  diagnostics: [
    async ({ page, allowConsole }, use) => {
      const diagnostics: Diagnostics = { errors: [], failedRequests: [], externalRequests: [] };
      page.on('pageerror', (error) => diagnostics.errors.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() !== 'error' && message.type() !== 'warning') return;
        const text = message.text();
        if (allowConsole.some((re) => re.test(text))) return;
        diagnostics.errors.push(`${message.type()}: ${text}`);
      });
      page.on('requestfailed', (request) => {
        // Downloads are intentionally aborted by the browser once saved.
        if (request.url().startsWith('blob:')) return;
        diagnostics.failedRequests.push(`${request.url()} (${request.failure()?.errorText})`);
      });
      page.on('response', (response) => {
        if (response.status() >= 400) diagnostics.failedRequests.push(`${response.status()} ${response.url()}`);
      });
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (!['localhost', '127.0.0.1'].includes(url.hostname) && !['blob:', 'data:'].includes(url.protocol)) {
          diagnostics.externalRequests.push(request.url());
        }
      });
      await use(diagnostics);
      expect(diagnostics.errors, 'console errors / uncaught exceptions').toEqual([]);
      expect(diagnostics.failedRequests, 'failed requests').toEqual([]);
      expect(diagnostics.externalRequests, 'requests to external hosts').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Installs a controllable clock (Date + timers) before the app loads. */
export async function installClock(page: Page, at: Date = START): Promise<void> {
  // Installed clocks keep flowing in real time; pausing makes time advance only via runFor().
  await page.clock.install({ time: new Date(at.getTime() - 1000) });
  await page.clock.pauseAt(at);
}

/** Advances virtual time in steps so React can re-render between timer batches. */
export async function advance(page: Page, ms: number, step = 1000): Promise<void> {
  for (let t = 0; t < ms; t += step) {
    await page.clock.runFor(Math.min(step, ms - t));
  }
}

export async function storedHistory(page: Page): Promise<Record<string, unknown>[]> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('calme.history');
    return raw ? (JSON.parse(raw) as { sessions: Record<string, unknown>[] }).sessions : [];
  });
}

export async function finishNow(page: Page): Promise<void> {
  await page.getByRole('dialog', { name: 'Terminer la séance maintenant ?' }).getByRole('button', { name: /^Terminer/ }).click();
}

/** Chooses a Calme pill option the way a user does: by clicking its visible label. */
export async function choose(page: Page, name: string | RegExp, scope?: import('@playwright/test').Locator): Promise<void> {
  const root = scope ?? page.locator('body');
  await root.locator('label').filter({ has: page.getByRole('radio', { name }) }).first().click();
  await expect(root.getByRole('radio', { name }).first()).toBeChecked();
}
