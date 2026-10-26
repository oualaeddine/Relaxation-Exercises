import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { advance, expect, installClock, test } from './fixtures';

async function axe(page: Page, label: string) {
  // axe-core relies on timers: let virtual time flow while it runs.
  await page.clock.resume().catch(() => undefined);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  const violations = results.violations.map((v) => `${label} — ${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(' | ')}`);
  expect(violations, `axe violations on ${label}`).toEqual([]);
}

const STATIC = ['/', '/exercices', '/exercices/respiration-carree', '/exercices/relaxation-musculaire', '/suivi', '/parametres', '/inconnu'];

test.describe('axe-core automated checks', () => {
  for (const path of STATIC) {
    test(`page ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      await axe(page, path);
    });
  }

  const PRACTICE: [string, RegExp][] = [
    ['respiration-lente', /Commencer la séance/],
    ['respiration-carree', /Commencer la séance/],
    ['expiration-levres-pincees', /Commencer la séance/],
    ['expiration-fredonnement', /Commencer la séance/],
    ['respiration-alternee', /Commencer la pratique/],
    ['soupir-physiologique', /Commencer le soupir/],
    ['relaxation-musculaire', /Commencer la séance/],
    ['scan-corporel', /Commencer la séance/],
    ['marche-attentive', /Commencer la marche/],
    ['ancrage-sensoriel', /Commencer l'ancrage/],
  ];
  for (const [id, start] of PRACTICE) {
    test(`practice ${id}: ready, running, paused, summary`, async ({ page }) => {
      await installClock(page);
      await page.goto(`/pratique/${id}`);
      await axe(page, `${id} ready`);
      await page.getByRole('button', { name: start }).click();
      await advance(page, 6000);
      await axe(page, `${id} running`);
      await page.keyboard.press('Space');
      await axe(page, `${id} paused`);
      await page.getByRole('button', { name: /^(Terminer|Terminer la séance|Terminer la séance maintenant|Conclure la séance maintenant|Quitter en douceur)$/ }).first().click();
      await axe(page, `${id} finish dialog`);
      await page.getByRole('button', { name: /^Terminer/ }).last().click();
      await expect(page.getByTestId('summary-status')).toBeVisible();
      await axe(page, `${id} summary`);
    });
  }

  test('library details sheet and settings dialogs', async ({ page }) => {
    await page.goto('/exercices');
    await page.getByRole('button', { name: 'Détails : Marche attentive' }).click();
    await axe(page, 'details sheet');
    await page.goto('/parametres');
    await page.getByRole('button', { name: "Supprimer tout l'historique" }).click();
    await axe(page, 'delete dialog');
  });
});

test.describe('keyboard and focus', () => {
  test('skip link, visible focus, keyboard-only practice', async ({ page }) => {
    await installClock(page);
    await page.goto('/pratique/respiration-lente');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Aller au contenu' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();

    // Reach and activate the start button with the keyboard only.
    const startButton = page.getByRole('button', { name: 'Commencer la séance' });
    for (let i = 0; i < 15 && !(await startButton.evaluate((el) => el === document.activeElement)); i += 1) {
      await page.keyboard.press('Tab');
    }
    await expect(startButton).toBeFocused();
    const outline = await startButton.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('phase-badge')).toHaveText('Inspiration');

    // Space on the page body toggles pause, without scrolling.
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('Space');
    await expect(page.getByText('Respirez naturellement')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Mettre en pause' })).toBeVisible();

    // The finish dialog traps focus and closes with Escape, returning focus.
    const finish = page.getByRole('button', { name: 'Terminer' });
    await finish.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Terminer la séance maintenant ?' });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(finish).toBeFocused();
  });

  test('guided exercise is fully operable by keyboard', async ({ page }) => {
    await installClock(page);
    await page.goto('/pratique/ancrage-sensoriel');
    await page.getByRole('button', { name: "Commencer l'ancrage" }).focus();
    await page.keyboard.press('Enter');
    for (let i = 0; i < 5; i += 1) {
      const next = page.getByRole('button', { name: i === 4 ? /Compléter la séance/ : /^Suivant/ });
      await next.focus();
      await page.keyboard.press('Enter');
    }
    await expect(page.getByTestId('summary-status')).toHaveText('Séance accomplie');
    await expect(page.locator('#summary-title')).toBeFocused();
  });

  test('phase status is not conveyed by colour alone and announcements are not per-second', async ({ page }) => {
    await installClock(page);
    await page.goto('/pratique/respiration-carree');
    await page.getByRole('button', { name: 'Commencer la séance' }).click();
    const announcer = page.getByTestId('announcer');
    await expect(announcer).toHaveText('Inspiration');
    const texts = new Set<string>();
    for (let i = 0; i < 8; i += 1) {
      await advance(page, 1000);
      texts.add((await announcer.textContent()) ?? '');
    }
    // 8 seconds = inhale + exhale: exactly two distinct announcements, not eight.
    expect([...texts]).toEqual(['Inspiration', 'Expiration']);
    await expect(page.getByTestId('phase-badge')).toHaveText(/Inspiration|Expiration/);
    // The per-second digits are hidden from assistive technology (on the element or an ancestor).
    expect(await page.getByTestId('phase-count').evaluate((el) => el.closest('[aria-hidden="true"]') !== null)).toBe(true);
  });

  test('reduced motion (OS setting) freezes breathing animations', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.clock.install({ time: new Date('2026-10-26T09:00:00+01:00') });
    await page.clock.pauseAt(new Date('2026-10-26T09:00:01+01:00'));
    await page.goto('/pratique/respiration-lente');
    await page.getByRole('button', { name: 'Commencer la séance' }).click();
    await page.clock.runFor(2000);
    await expect(page.getByTestId('breath-visual')).toHaveAttribute('data-scale', '1.000');
    const animated = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
    expect(animated).toBe(0);
    await context.close();
  });
});
