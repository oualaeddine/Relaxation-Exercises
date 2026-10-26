import type { Page } from '@playwright/test';
import { advance, expect, finishNow, installClock, storedHistory, test } from './fixtures';

interface Case {
  id: string;
  title: string;
  /** Text from the "Comment pratiquer" instructions. */
  instruction: RegExp;
  start: RegExp;
  /** Verifies the initial state and exercises the central interaction. */
  interact: (page: Page) => Promise<void>;
  /** Expected history outcome after "Terminer". */
  record: Record<string, unknown>;
  /** Finishes by completing the plan instead of finishing early. */
  completes?: boolean;
}

const pauseResume = async (page: Page, pause = /Mettre en pause|^Pause$|Prendre mon temps/, resume = /Reprendre/) => {
  await page.getByRole('button', { name: pause }).first().click();
  await expect(page.getByRole('button', { name: resume }).first()).toBeVisible();
  await advance(page, 5000);
  await page.getByRole('button', { name: resume }).first().click();
};

const CASES: Case[] = [
  {
    id: 'respiration-lente',
    title: 'Respiration lente',
    instruction: /pendant 4 secondes/,
    start: /^Commencer la séance$/,
    interact: async (page) => {
      await expect(page.getByTestId('phase-badge')).toHaveText('Inspiration');
      await advance(page, 4000);
      await expect(page.getByTestId('phase-badge')).toHaveText('Expiration');
      await pauseResume(page, /Mettre en pause/, /Reprendre la séance/);
      await advance(page, 6000);
      await expect(page.getByTestId('cycle')).toHaveText('2 / 30');
    },
    record: { status: 'partial', activeSeconds: 10, cyclesCompleted: 1 },
  },
  {
    id: 'respiration-carree',
    title: 'Respiration carrée',
    instruction: /Visualisez un carré/,
    start: /^Commencer la séance$/,
    interact: async (page) => {
      await expect(page.getByTestId('phase-badge')).toHaveText('Inspiration');
      await advance(page, 1000);
      await page.getByRole('button', { name: 'Activer pauses' }).click(); // mid-cycle → applies at the next cycle
      await advance(page, 3000);
      await expect(page.getByTestId('phase-badge')).toHaveText('Expiration');
      await advance(page, 8000); // new cycle with holds: inhale 4 s then hold
      await expect(page.getByTestId('phase-badge')).toHaveText('Pause haute');
      await pauseResume(page, /Mettre en pause/, /^Reprendre$/);
    },
    record: { status: 'partial', activeSeconds: 12, cyclesCompleted: 1 },
  },
  {
    id: 'expiration-levres-pincees',
    title: 'Expiration à lèvres pincées',
    instruction: /souffler sur une bougie/,
    start: /^Commencer la séance$/,
    interact: async (page) => {
      await expect(page.getByTestId('phase-badge')).toHaveText('Inspiration nasale');
      await advance(page, 2000);
      await expect(page.getByTestId('phase-badge')).toHaveText('Expiration douce');
      await pauseResume(page, /Mettre en pause/, /Reprendre la séance/);
      await advance(page, 4000);
      await expect(page.getByTestId('cycle')).toHaveText('Cycle 2 sur 20');
    },
    record: { status: 'partial', activeSeconds: 6, cyclesCompleted: 1 },
  },
  {
    id: 'expiration-fredonnement',
    title: 'Expiration avec fredonnement',
    instruction: /« mmmm »/,
    start: /^Commencer la séance$/,
    interact: async (page) => {
      await expect(page.getByTestId('phase-badge')).toHaveText('Inspiration douce');
      await advance(page, 3000);
      await expect(page.getByTestId('phase-badge')).toHaveText('Expiration sonore');
      await advance(page, 8000);
      await expect(page.getByTestId('repetition')).toContainText('Répétition 2 sur 5');
      await page.getByRole('button', { name: 'Répétition terminée' }).click();
      await expect(page.getByTestId('repetition')).toContainText('Répétition 3 sur 5');
      await page.getByRole('button', { name: 'Mettre en pause' }).click();
      await expect(page.getByRole('heading', { name: 'Respirez naturellement' })).toBeVisible();
      await page.getByRole('button', { name: 'Reprendre la pratique' }).click();
      await page.getByRole('button', { name: 'Passer ce cycle' }).click();
      await advance(page, 1000);
    },
    record: { status: 'partial', unitsCompleted: 2, unitsSkipped: 1, unitsTotal: 5 },
  },
  {
    id: 'respiration-alternee',
    title: 'Respiration alternée',
    instruction: /narine gauche/,
    start: /^Commencer la pratique$/,
    interact: async (page) => {
      await expect(page.getByTestId('instruction')).toHaveText('Inspirez doucement par la narine gauche.');
      await expect(page.getByTestId('nostril-gauche')).toHaveAttribute('data-state', 'ouverte');
      await advance(page, 4000);
      await expect(page.getByTestId('instruction')).toHaveText('Fermez la narine gauche et expirez à droite.');
      await expect(page.getByTestId('nostril-droite')).toHaveAttribute('data-state', 'ouverte');
      await page.getByRole('button', { name: 'Étape suivante' }).click();
      await expect(page.getByTestId('step-label')).toHaveText('Étape 3 sur 4');
      await page.getByRole('button', { name: 'Étape précédente' }).click();
      await expect(page.getByTestId('step-label')).toHaveText('Étape 2 sur 4');
      await page.getByRole('button', { name: 'Mettre en pause' }).click();
      await expect(page.getByRole('heading', { name: 'Prenez votre temps' })).toBeVisible();
      await page.getByRole('button', { name: 'Reprendre la pratique' }).click();
      await advance(page, 2000);
    },
    record: { status: 'partial', unitsTotal: 9, unitsCompleted: 0 },
  },
  {
    id: 'soupir-physiologique',
    title: 'Soupir physiologique doux',
    instruction: /seconde petite inspiration/,
    start: /^Commencer le soupir/,
    interact: async (page) => {
      await expect(page.getByTestId('phase-badge')).toHaveText('1ʳᵉ inspiration');
      await advance(page, 3000);
      await expect(page.getByTestId('phase-badge')).toHaveText('Appoint doux');
      await advance(page, 1500);
      await expect(page.getByTestId('phase-badge')).toHaveText('Expiration lente');
      await advance(page, 6000);
      await expect(page.getByTestId('repetition')).toContainText('Répétition 2 sur 3');
      await pauseResume(page, /^Pause$/, /^Reprendre$/);
      await advance(page, 10_500);
      await advance(page, 10_500);
    },
    completes: true,
    record: { status: 'completed', unitsCompleted: 3, unitsTotal: 3 },
  },
  {
    id: 'relaxation-musculaire',
    title: 'Relaxation musculaire progressive',
    instruction: /20 à 30 %/,
    start: /^Commencer la séance$/,
    interact: async (page) => {
      await expect(page.getByTestId('group-title')).toHaveText('Mains et poignets');
      await expect(page.getByTestId('phase-badge')).toHaveText('Contraction douce');
      await expect(page.getByTestId('body-map')).toHaveAttribute('data-group', 'mains');
      await advance(page, 5000);
      await expect(page.getByTestId('phase-badge')).toHaveText('Relâchement complet');
      await page.getByRole('button', { name: 'Suivant' }).click();
      await expect(page.getByTestId('group-title')).toHaveText('Bras et avant-bras');
      await expect(page.getByTestId('body-map')).toHaveAttribute('data-group', 'bras');
      await page.getByRole('button', { name: 'Passer cette zone' }).click();
      await expect(page.getByTestId('group-title')).toHaveText('Épaules et nuque');
      await pauseResume(page, /^Pause$/, /^Reprendre$/);
    },
    record: { status: 'partial', unitsCompleted: 1, unitsSkipped: 1, unitsTotal: 7 },
  },
  {
    id: 'scan-corporel',
    title: 'Scan corporel bienveillant',
    instruction: /faisceau lumineux/,
    start: /^Commencer la séance$/,
    interact: async (page) => {
      await expect(page.getByTestId('zone-title')).toHaveText('1. Pieds & ancrage');
      await advance(page, 37_500);
      await expect(page.getByTestId('zone-title')).toHaveText('2. Bas des jambes');
      await page.getByRole('button', { name: 'Zone suivante' }).click();
      await expect(page.getByTestId('zone-counter')).toHaveText('Zone 3 sur 8');
      await page.getByRole('button', { name: 'Zone précédente' }).click();
      await expect(page.getByTestId('zone-counter')).toHaveText('Zone 2 sur 8');
      await pauseResume(page, /^Pause$/, /^Reprendre$/);
    },
    record: { status: 'partial', unitsCompleted: 2, unitsTotal: 8 },
  },
  {
    id: 'marche-attentive',
    title: 'Marche attentive',
    instruction: /aucun rythme respiratoire n’est imposé/,
    start: /^Commencer la marche$/,
    interact: async (page) => {
      await expect(page.getByTestId('breathing-mode')).toContainText('aucun rythme imposé');
      await expect(page.getByTestId('prompt-text')).toHaveText('Remarquez le contact de vos pieds avec le sol.');
      await advance(page, 90_000, 5000);
      await expect(page.getByTestId('prompt-text')).toHaveText('Sentez le rythme naturel de vos pas.');
      await page.getByRole('button', { name: /Invite suivante/ }).click();
      await expect(page.getByTestId('prompt-counter')).toHaveText('Invite 3 sur 5');
      await pauseResume(page, /^Pause$/, /^Reprendre$/);
      await expect(page.getByTestId('remaining')).toHaveText('08:30');
    },
    record: { status: 'partial', activeSeconds: 90, targetSeconds: 600 },
  },
  {
    id: 'ancrage-sensoriel',
    title: 'Ancrage sensoriel 5-4-3-2-1',
    instruction: /5 objets que vous voyez/,
    start: /^Commencer l'ancrage$/,
    interact: async (page) => {
      const seen: string[] = [];
      for (let i = 0; i < 5; i += 1) {
        seen.push((await page.getByTestId('grounding-count').textContent()) ?? '');
        await advance(page, 4000);
        if (i === 2) await pauseResume(page, /Prendre mon temps/, /^Reprendre$/);
        await page.getByRole('button', { name: i === 4 ? /Compléter la séance/ : /^Suivant/ }).click();
      }
      expect(seen).toEqual(['5', '4', '3', '2', '1']);
    },
    completes: true,
    record: { status: 'completed', unitsCompleted: 5, unitsTotal: 5, activeSeconds: 20 },
  },
];

test.describe('Scenario 4 — all ten exercises', () => {
  for (const c of CASES) {
    test(c.title, async ({ page }) => {
      await installClock(page);
      await page.goto('/exercices');
      await page.getByRole('button', { name: `Détails : ${c.title}` }).click();
      const sheet = page.getByRole('dialog', { name: c.title });
      await expect(sheet).toContainText(c.instruction);
      await sheet.getByRole('button', { name: 'Retour à la liste' }).click();
      await page.getByRole('link', { name: `Commencer : ${c.title}` }).click();
      await expect(page).toHaveURL(new RegExp(`/pratique/${c.id}$`));
      await page.getByRole('button', { name: c.start }).click();
      await expect(page.getByTestId('breath-visual')).toBeVisible();

      await c.interact(page);

      if (!c.completes) {
        await page.getByRole('button', { name: /^(Terminer|Terminer la séance|Terminer la séance maintenant|Conclure la séance maintenant|Quitter en douceur)$/ }).first().click();
        await finishNow(page);
      }
      await expect(page.getByTestId('summary-status')).toHaveText(c.completes ? 'Séance accomplie' : 'Séance terminée plus tôt');
      await expect(page.getByTestId('save-state')).toContainText('Séance enregistrée');
      const history = await storedHistory(page);
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({ exerciseId: c.id, ...c.record });
    });
  }
});
