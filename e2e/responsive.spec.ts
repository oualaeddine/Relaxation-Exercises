import type { Page } from '@playwright/test';
import { advance, expect, installClock, test } from './fixtures';

const VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 568 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 900 },
] as const;

const SEED = [
  {
    id: 'seed-1',
    exerciseId: 'respiration-lente',
    status: 'completed',
    startedAt: '2026-10-26T07:00:00.000Z',
    endedAt: '2026-10-26T07:05:00.000Z',
    activeSeconds: 300,
    pausedSeconds: 0,
    targetSeconds: 300,
    unitsTotal: null,
    unitsCompleted: null,
    unitsSkipped: null,
    cyclesCompleted: 30,
    feeling: 'calme',
  },
  {
    id: 'seed-2',
    exerciseId: 'relaxation-musculaire',
    status: 'partial',
    startedAt: '2026-10-24T19:00:00.000Z',
    endedAt: '2026-10-24T19:04:00.000Z',
    activeSeconds: 210,
    pausedSeconds: 30,
    targetSeconds: null,
    unitsTotal: 7,
    unitsCompleted: 3,
    unitsSkipped: 1,
    cyclesCompleted: null,
    feeling: null,
  },
];

interface Screen {
  name: string;
  setup: (page: Page) => Promise<void>;
  /** A control that must be fully visible and usable without horizontal scrolling. */
  primary?: { role: 'button' | 'link'; name: RegExp };
  timer?: string;
}

const start = (path: string, button: RegExp, ms = 3000) => async (page: Page) => {
  await page.goto(path);
  await page.getByRole('button', { name: button }).click();
  await advance(page, ms);
};

const SCREENS: Screen[] = [
  { name: 'accueil', setup: async (p) => void (await p.goto('/')), primary: { role: 'link', name: /Commencer une séance/ } },
  { name: 'bibliotheque', setup: async (p) => void (await p.goto('/exercices')), primary: { role: 'link', name: /Commencer : Respiration lente/ } },
  { name: 'detail', setup: async (p) => void (await p.goto('/exercices/relaxation-musculaire')), primary: { role: 'button', name: /Démarrer la séance guidée/ } },
  { name: 'lente-en-cours', setup: start('/pratique/respiration-lente', /Commencer la séance/), primary: { role: 'button', name: /^Mettre en pause$/ }, timer: 'phase-count' },
  {
    name: 'lente-pause',
    setup: async (p) => {
      await start('/pratique/respiration-lente', /Commencer la séance/)(p);
      await p.getByRole('button', { name: 'Mettre en pause' }).click();
    },
    primary: { role: 'button', name: /Reprendre la séance/ },
  },
  {
    name: 'lente-bilan',
    setup: async (p) => {
      await start('/pratique/respiration-lente', /Commencer la séance/, 30_000)(p);
      await p.getByRole('button', { name: 'Terminer' }).click();
      await p.getByRole('button', { name: 'Terminer et enregistrer' }).click();
    },
    primary: { role: 'button', name: /Voir Mon suivi/ },
  },
  { name: 'carree-en-cours', setup: start('/pratique/respiration-carree', /Commencer la séance/, 5000), primary: { role: 'button', name: /Pause|Mettre en pause/ }, timer: 'phase-count' },
  { name: 'ancrage-en-cours', setup: start('/pratique/ancrage-sensoriel', /Commencer l'ancrage/, 1000), primary: { role: 'button', name: /^Suivant/ } },
  { name: 'relaxation-en-cours', setup: start('/pratique/relaxation-musculaire', /Commencer la séance/, 2000), primary: { role: 'button', name: /^Suivant/ }, timer: 'phase-count' },
  { name: 'suivi', setup: async (p) => void (await p.goto('/suivi')), primary: { role: 'button', name: /Exporter en CSV/ } },
  { name: 'parametres', setup: async (p) => void (await p.goto('/parametres')), primary: { role: 'button', name: /Enregistrer l'objectif/ } },
];

for (const vp of VIEWPORTS) {
  test.describe(`viewport ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const screen of SCREENS) {
      test(screen.name, async ({ page }, testInfo) => {
        await installClock(page);
        await page.addInitScript((seed) => {
          if (!localStorage.getItem('calme.history')) localStorage.setItem('calme.history', JSON.stringify({ schemaVersion: 1, sessions: seed }));
        }, SEED);
        await screen.setup(page);
        await page.evaluate(() => document.fonts.ready);

        // No unintended horizontal scrolling.
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, 'horizontal overflow (px)').toBeLessThanOrEqual(0);

        // Navigation mode: bottom bar on phones/tablets, header navigation on desktop.
        const navInHeader = await page.locator('header').getByRole('navigation', { name: 'Navigation principale' }).count();
        expect(navInHeader).toBe(vp.width >= 1024 ? 1 : 0);

        // Primary control fully visible horizontally, comfortably sized, not covered.
        if (screen.primary) {
          const control = page.getByRole(screen.primary.role, { name: screen.primary.name }).first();
          await control.scrollIntoViewIfNeeded();
          const box = await control.boundingBox();
          expect(box, 'primary control box').not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
          expect(box!.height).toBeGreaterThanOrEqual(36);
          await control.click({ trial: true }); // fails if another element intercepts the pointer
        }

        // Interactive elements in <main> keep usable touch targets on small screens.
        if (vp.width < 768) {
          const small = await page.locator('main').evaluate((main) =>
            [...main.querySelectorAll<HTMLElement>('button, a[href], select, input:not([type="radio"]):not([type="checkbox"]):not([type="range"]):not([type="file"])')]
              .filter((el) => el.offsetParent !== null && !el.closest('.sr-only'))
              .map((el) => ({ el, r: el.getBoundingClientRect() }))
              .filter(({ r }) => r.width > 0 && (r.height < 32 || r.width < 32))
              .map(({ el, r }) => `${el.tagName} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}" ${Math.round(r.width)}×${Math.round(r.height)}`),
          );
          expect(small, 'touch targets smaller than 32 px').toEqual([]);
        }

        // Buttons must not overlap each other.
        const overlaps = await page.locator('main').evaluate((main) => {
          const els = [...main.querySelectorAll<HTMLElement>('button, a[href]')].filter((el) => el.offsetParent !== null && !el.closest('.sr-only'));
          const boxes = els.map((el) => ({ el, r: el.getBoundingClientRect() })).filter(({ r }) => r.width > 0 && r.height > 0);
          const found: string[] = [];
          for (let i = 0; i < boxes.length; i += 1) {
            for (let j = i + 1; j < boxes.length; j += 1) {
              const a = boxes[i]!;
              const b = boxes[j]!;
              if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
              const ix = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
              const iy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
              if (ix > 2 && iy > 2) found.push(`${a.el.textContent?.trim().slice(0, 30)} ⟷ ${b.el.textContent?.trim().slice(0, 30)}`);
            }
          }
          return found;
        });
        expect(overlaps, 'overlapping controls').toEqual([]);

        // Timer digits stay readable.
        if (screen.timer) {
          const size = await page.getByTestId(screen.timer).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
          expect(size).toBeGreaterThanOrEqual(28);
        }

        // Breathing visual keeps a square, stable proportion.
        const visual = page.getByTestId('breath-visual').first();
        if ((await visual.count()) > 0 && screen.name.startsWith('lente')) {
          const vb = await visual.boundingBox();
          if (vb) expect(Math.abs(vb.width - vb.height)).toBeLessThanOrEqual(2);
        }

        await page.screenshot({ path: testInfo.outputPath(`${vp.name}-${screen.name}.png`), fullPage: true });
        await page.screenshot({ path: `test-results/screens/${vp.name}-${screen.name}.png`, fullPage: true });
      });
    }
  });
}
