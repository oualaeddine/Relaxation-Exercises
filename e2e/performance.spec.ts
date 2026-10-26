import type { Page } from '@playwright/test';
import { advance, expect, installClock, test } from './fixtures';

/** Counts live intervals and localStorage writes (installed after the fake clock). */
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __intervals: Set<unknown>; __writes: string[] };
    w.__intervals = new Set();
    w.__writes = [];
    const set = window.setInterval.bind(window);
    const clear = window.clearInterval.bind(window);
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const id = set(handler, timeout, ...args);
      w.__intervals.add(id);
      return id;
    }) as typeof window.setInterval;
    window.clearInterval = ((id?: number) => {
      w.__intervals.delete(id);
      clear(id);
    }) as typeof window.clearInterval;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      w.__writes.push(key);
      return setItem.call(this, key, value);
    };
  });
}

const intervals = (page: Page) => page.evaluate(() => (window as unknown as { __intervals: Set<unknown> }).__intervals.size);
const writes = (page: Page) => page.evaluate(() => (window as unknown as { __writes: string[] }).__writes.slice());
const resetWrites = (page: Page) => page.evaluate(() => void ((window as unknown as { __writes: string[] }).__writes.length = 0));

test('no timer leaks or duplicated timers across route changes', async ({ page }) => {
  await installClock(page);
  await instrument(page);
  await page.goto('/');
  const baseline = await intervals(page);
  for (let round = 0; round < 3; round += 1) {
    await page.goto('/exercices');
    await page.getByRole('link', { name: 'Commencer : Respiration lente' }).click();
    // First round starts a session; later rounds land on the same (auto-paused) session.
    if (round === 0) await page.getByRole('button', { name: 'Commencer la séance' }).click();
    else await page.getByRole('button', { name: 'Reprendre la séance' }).click();
    await advance(page, 3000);
    expect(await intervals(page), 'one ticking interval while practising').toBeLessThanOrEqual(baseline + 1);
    await page.getByRole('button', { name: 'Retour aux exercices' }).click();
    await advance(page, 3000);
    expect(await intervals(page), 'no interval left after leaving practice').toBe(baseline);
  }
});

test('storage is written on transitions and checkpoints only, never on every tick', async ({ page }) => {
  await installClock(page);
  await instrument(page);
  await page.goto('/pratique/respiration-lente');
  await page.getByRole('button', { name: 'Commencer la séance' }).click();
  await resetWrites(page);
  await advance(page, 60_000, 250); // 240 ticks
  const during = (await writes(page)).filter((k) => k.startsWith('calme.'));
  // Checkpoints every 10 s → about 6 writes in a minute (not 240).
  expect(during.length).toBeGreaterThanOrEqual(4);
  expect(during.length).toBeLessThanOrEqual(7);
  expect(new Set(during)).toEqual(new Set(['calme.activeSession']));
});

test('nothing keeps running after finishing or cancelling', async ({ page }) => {
  await installClock(page);
  await instrument(page);
  await page.goto('/');
  const baseline = await intervals(page);
  await page.goto('/pratique/respiration-carree');
  await page.getByRole('button', { name: 'Commencer la séance' }).click();
  await advance(page, 20_000);
  await page.getByRole('button', { name: 'Terminer la séance' }).click();
  await page.getByRole('button', { name: 'Terminer et enregistrer' }).click();
  await expect(page.getByTestId('summary-status')).toBeVisible();
  await resetWrites(page);
  await advance(page, 30_000);
  expect(await intervals(page)).toBe(baseline);
  expect(await writes(page)).toEqual([]);

  await page.getByRole('button', { name: 'Recommencer une séance' }).click();
  await advance(page, 5000);
  await page.getByRole('button', { name: 'Terminer la séance' }).click();
  await page.getByRole('button', { name: 'Abandonner sans enregistrer' }).click();
  await resetWrites(page);
  await advance(page, 30_000);
  expect(await intervals(page)).toBe(baseline);
  expect(await writes(page)).toEqual([]);
});

test('production build serves only local assets and loads quickly', async ({ page }) => {
  const responses: { url: string; type: string; size: number }[] = [];
  page.on('response', async (response) => {
    const body = await response.body().catch(() => Buffer.alloc(0));
    responses.push({ url: response.url(), type: response.request().resourceType(), size: body.length });
  });
  const startTime = Date.now();
  await page.goto('/', { waitUntil: 'networkidle' });
  const elapsed = Date.now() - startTime;
  const scripts = responses.filter((r) => r.type === 'script');
  const fonts = responses.filter((r) => r.type === 'font');
  expect(scripts.length).toBeGreaterThan(0);
  expect(fonts.length).toBeGreaterThan(0);
  expect(responses.every((r) => r.url.startsWith('http://localhost:4173'))).toBe(true);
  // Generous bound on a local server; reported, not a Lighthouse score.
  expect(elapsed).toBeLessThan(5000);
  test.info().annotations.push({ type: 'load', description: `networkidle in ${elapsed} ms, ${responses.length} requests, JS ${scripts.reduce((s, r) => s + r.size, 0)} bytes` });
});
