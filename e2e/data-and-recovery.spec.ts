import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { advance, choose, expect, finishNow, installClock, START, storedHistory, test } from './fixtures';

async function quickSession(page: Page, path: string, startName: RegExp, seconds: number, finish = true) {
  await page.goto(path);
  await page.getByRole('button', { name: startName }).click();
  await advance(page, seconds * 1000);
  if (finish) {
    await page.getByRole('button', { name: /^Terminer$/ }).first().click();
    await finishNow(page);
    await expect(page.getByTestId('save-state')).toContainText('Séance enregistrée');
  }
}

test.describe('Scenario 5 — early finish and cancellation', () => {
  test('early finish is partial; cancellation creates nothing', async ({ page }) => {
    await installClock(page);
    await quickSession(page, '/pratique/expiration-levres-pincees', /Commencer la séance/, 40);
    await expect(page.getByTestId('summary-status')).toHaveText('Séance terminée plus tôt');
    await expect(page.getByTestId('summary-active')).toHaveText('40 s');

    await page.goto('/pratique/respiration-carree');
    await page.getByRole('button', { name: 'Commencer la séance' }).click();
    await advance(page, 30_000);
    await page.getByRole('button', { name: 'Terminer la séance' }).click();
    await page.getByRole('button', { name: 'Abandonner sans enregistrer' }).click();
    await expect(page.getByRole('button', { name: 'Commencer la séance' })).toBeVisible();

    const history = await storedHistory(page);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ exerciseId: 'expiration-levres-pincees', status: 'partial' });
    await page.goto('/suivi');
    await expect(page.getByTestId('completed-count')).toHaveText('0');
    await expect(page.getByTestId('partial-count')).toHaveText('1');
  });

  test('finishing within the first seconds records nothing and says so', async ({ page }) => {
    await installClock(page);
    await page.goto('/pratique/respiration-lente');
    await page.getByRole('button', { name: 'Commencer la séance' }).click();
    await advance(page, 2000);
    await page.getByRole('button', { name: 'Terminer' }).click();
    await expect(page.getByRole('dialog')).toContainText('Moins de 5 secondes');
    await finishNow(page);
    await expect(page.getByTestId('save-state')).toContainText('trop courte');
    expect(await storedHistory(page)).toHaveLength(0);
  });
});

test.describe('Scenario 6 — history, statistics, export and deletion', () => {
  test('multiple sessions, filters, totals, CSV/JSON export, delete all', async ({ page }) => {
    await installClock(page);
    await quickSession(page, '/pratique/respiration-lente', /Commencer la séance/, 60);
    await page.getByRole('button', { name: 'Recommencer une séance' }).click();
    await advance(page, 30_000);
    await page.getByRole('button', { name: 'Terminer' }).click();
    await finishNow(page);
    await quickSession(page, '/pratique/expiration-levres-pincees', /Commencer la séance/, 120, false);
    await expect(page.getByTestId('summary-status')).toHaveText('Séance accomplie');

    await page.goto('/suivi');
    const list = page.getByTestId('session-list');
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await expect(page.getByTestId('total-minutes')).toHaveText('3'); // 60 + 30 + 120 s
    await expect(page.getByTestId('completed-count')).toHaveText('1');
    await expect(page.getByTestId('partial-count')).toHaveText('2');

    await page.getByLabel('Exercice', { exact: true }).selectOption('respiration-lente');
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await expect(page.getByTestId('filtered-summary')).toHaveText('2 séances · 1 min 30');
    await page.getByLabel('Exercice', { exact: true }).selectOption('all');
    await page.getByLabel('Du').fill('2026-10-27');
    await expect(page.getByText('Aucune séance ne correspond à ces filtres.')).toBeVisible();
    await page.getByLabel('Du').fill('2026-10-26');
    await page.getByLabel('Au').fill('2026-10-26');
    await expect(list.getByRole('listitem')).toHaveCount(3);

    const csvDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter en CSV' }).click();
    const csv = await readFile(await (await csvDownload).path(), 'utf8');
    expect((await csvDownload).suggestedFilename()).toBe('calme-historique-2026-10-26.csv');
    const lines = csv.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines[0]).toBe(
      'id,exercice_id,exercice,statut,debut_iso,fin_iso,date_locale,duree_active_secondes,duree_pause_secondes,objectif_secondes,unites_terminees,unites_passees,unites_total,cycles_termines,ressenti',
    );
    expect(lines).toHaveLength(4);
    expect(csv).toContain('Expiration à lèvres pincées');
    expect(csv).toContain('Terminée plus tôt');

    const jsonDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Sauvegarde JSON' }).click();
    const backup = JSON.parse(await readFile(await (await jsonDownload).path(), 'utf8')) as { schemaVersion: number; sessions: { id: string; activeSeconds: number }[] };
    expect(backup.schemaVersion).toBe(1);
    expect(backup.sessions.map((s) => s.activeSeconds).sort((a, b) => a - b)).toEqual([30, 60, 120]);
    const byId = (a: { id?: unknown }, b: { id?: unknown }) => String(a.id).localeCompare(String(b.id));
    expect([...backup.sessions].sort(byId)).toEqual([...(await storedHistory(page))].sort(byId));

    await page.goto('/parametres');
    await page.getByRole('button', { name: "Supprimer tout l'historique" }).click();
    const dialog = page.getByRole('dialog', { name: "Supprimer tout l'historique ?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Supprimer définitivement' }).click();
    await expect(page.getByText("L'historique a été supprimé.")).toBeVisible();
    await page.goto('/suivi');
    await expect(page.getByRole('heading', { name: 'Aucune séance enregistrée' })).toBeVisible();
    await expect(page.getByTestId('total-minutes')).toHaveText('0');
    await page.goto('/');
    await expect(page.getByTestId('week-minutes')).toHaveText('0');
  });

  test('a JSON backup can be imported into a clean profile', async ({ page }) => {
    await installClock(page);
    const backup = {
      app: 'calme',
      kind: 'historique',
      schemaVersion: 1,
      exportedAt: START.toISOString(),
      sessions: [
        {
          id: 'importee-1',
          exerciseId: 'scan-corporel',
          status: 'completed',
          startedAt: '2026-10-25T18:00:00.000Z',
          endedAt: '2026-10-25T18:05:00.000Z',
          activeSeconds: 300,
          pausedSeconds: 0,
          targetSeconds: null,
          unitsTotal: 8,
          unitsCompleted: 8,
          unitsSkipped: 0,
          cyclesCompleted: null,
          feeling: null,
        },
      ],
    };
    await page.goto('/parametres');
    await page.getByLabel('Importer une sauvegarde JSON').setInputFiles({ name: 'calme.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await page.getByRole('dialog', { name: 'Importer cette sauvegarde ?' }).getByRole('button', { name: "Confirmer l'import" }).click();
    await expect(page.getByText(/Import terminé : 1 séance/)).toBeVisible();
    await page.goto('/suivi');
    await expect(page.getByTestId('session-list')).toContainText('Scan corporel bienveillant');
  });
});

test.describe('Scenario 7 — grounding and guided relaxation', () => {
  test('5-4-3-2-1 forward/backward, then muscle relaxation with a skipped group', async ({ page }) => {
    await installClock(page);
    await page.goto('/pratique/ancrage-sensoriel');
    await page.getByRole('button', { name: "Commencer l'ancrage" }).click();
    const count = page.getByTestId('grounding-count');
    await expect(count).toHaveText('5');
    await expect(page.getByTestId('step-counter')).toHaveText('Étape 1 sur 5');
    await page.getByRole('button', { name: /^Suivant/ }).click();
    await page.getByRole('button', { name: /^Suivant/ }).click();
    await expect(count).toHaveText('3');
    await expect(page.getByTestId('grounding-title')).toHaveText('3 sons que vous entendez');
    await page.getByRole('button', { name: 'Étape précédente' }).click();
    await expect(count).toHaveText('4');
    await expect(page.getByTestId('step-counter')).toHaveText('Étape 2 sur 5');
    for (const expected of ['3', '2', '1']) {
      await page.getByRole('button', { name: /^Suivant/ }).click();
      await expect(count).toHaveText(expected);
    }
    await advance(page, 30_000);
    await page.getByRole('button', { name: /Compléter la séance/ }).click();
    await expect(page.getByTestId('summary-units')).toHaveText('5 / 5');

    await page.goto('/pratique/relaxation-musculaire');
    await page.getByRole('button', { name: 'Commencer la séance' }).click();
    await expect(page.getByTestId('group-title')).toHaveText('Mains et poignets');
    await advance(page, 65_000, 5000); // standard preset: 3 × (5 + 10) + 20 s per group
    await expect(page.getByTestId('group-title')).toHaveText('Bras et avant-bras');
    await expect(page.getByTestId('phase-badge')).toHaveText('Contraction douce');
    await page.getByRole('button', { name: 'Passer cette zone' }).click();
    await expect(page.getByTestId('group-title')).toHaveText('Épaules et nuque');
    await page.getByRole('button', { name: 'Pause' }).click();
    await advance(page, 20_000);
    await page.getByRole('button', { name: 'Reprendre' }).click();
    await advance(page, 5000);
    await page.getByRole('button', { name: 'Terminer la séance' }).click();
    await finishNow(page);
    const history = await storedHistory(page);
    expect(history.find((r) => r.exerciseId === 'relaxation-musculaire')).toMatchObject({
      status: 'partial',
      unitsCompleted: 1,
      unitsSkipped: 1,
      activeSeconds: 70,
      pausedSeconds: 20,
    });
  });

  test('a sensitive zone excluded on the detail page is skipped automatically', async ({ page }) => {
    await installClock(page);
    await page.goto('/exercices/relaxation-musculaire');
    await choose(page, /≈ 5 min/);
    await page.getByRole('checkbox', { name: 'Inclure : Mains et poignets' }).uncheck();
    await page.getByRole('button', { name: 'Démarrer la séance guidée' }).click();
    await expect(page.getByTestId('group-title')).toHaveText('Bras et avant-bras');
    await expect(page.getByTestId('group-counter')).toHaveText('Groupe 1 sur 6');
  });
});

test.describe('Scenario 8 — error recovery', () => {
  test('invalid saved data does not crash the app', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('calme.history', '{"schemaVersion":1,"sessions":[{"id":"x"},42,null]}');
        localStorage.setItem('calme.preferences', '<<<');
        localStorage.setItem('calme.activeSession', '{"broken":');
        sessionStorage.setItem('seeded', '1');
      }
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Prenez un moment pour vous.' })).toBeVisible();
    await page.goto('/parametres');
    await expect(page.getByText(/3 enregistrement\(s\) illisible\(s\)/)).toBeVisible();
    await page.getByRole('button', { name: 'Supprimer les données illisibles' }).click();
    await expect(page.getByText('Les enregistrements illisibles ont été supprimés.')).toBeVisible();
  });

  test('a storage write failure is recoverable', async ({ page }) => {
    await installClock(page);
    await page.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key === 'calme.history' && (window as unknown as { __failHistory?: boolean }).__failHistory) {
          throw new DOMException('Quota dépassé', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      };
    });
    await page.goto('/pratique/respiration-lente');
    await page.getByRole('button', { name: 'Commencer la séance' }).click();
    await advance(page, 20_000);
    await page.evaluate(() => {
      (window as unknown as { __failHistory?: boolean }).__failHistory = true;
    });
    await page.getByRole('button', { name: 'Terminer' }).click();
    await finishNow(page);
    await expect(page.getByTestId('save-state')).toContainText('n’a pas pu être enregistrée');
    await page.evaluate(() => {
      (window as unknown as { __failHistory?: boolean }).__failHistory = false;
    });
    await page.getByRole('button', { name: 'Réessayer l’enregistrement' }).click();
    await expect(page.getByTestId('save-state')).toContainText('Séance enregistrée');
    expect(await storedHistory(page)).toHaveLength(1);
  });

  test('rapid repeated clicks never create duplicate records', async ({ page }) => {
    await installClock(page);
    await page.goto('/pratique/respiration-lente');
    const start = page.getByRole('button', { name: 'Commencer la séance' });
    await start.click();
    await expect(start).toHaveCount(0);
    for (let i = 0; i < 6; i += 1) {
      await page.getByRole('button', { name: /Mettre en pause|Reprendre la séance/ }).click();
    }
    await expect(page.getByRole('button', { name: 'Mettre en pause' })).toBeVisible();
    await advance(page, 15_000);
    await page.getByRole('button', { name: 'Terminer' }).click();
    const confirm = page.getByRole('dialog').getByRole('button', { name: 'Terminer et enregistrer' });
    await confirm.dblclick({ force: true }).catch(() => undefined);
    await expect(page.getByTestId('summary-status')).toBeVisible();
    await page.keyboard.press('Space');
    await advance(page, 5000);
    expect(await storedHistory(page)).toHaveLength(1);
  });

  test('finishing exactly when the last phase ends records one completed session', async ({ page }) => {
    await installClock(page);
    await page.goto('/exercices/expiration-levres-pincees');
    await choose(page, /^1 min/);
    await page.getByRole('button', { name: 'Démarrer la séance guidée' }).click();
    await advance(page, 59_000);
    await page.getByRole('button', { name: 'Terminer' }).click();
    await page.clock.runFor(1000); // the target is reached while the dialog is open
    await expect(page.getByTestId('summary-status')).toHaveText('Séance accomplie');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const history = await storedHistory(page);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ status: 'completed', activeSeconds: 60 });
  });

  test('navigating away pauses the session and stops all timers', async ({ page }) => {
    await installClock(page);
    await page.goto('/pratique/respiration-lente');
    await page.getByRole('button', { name: 'Commencer la séance' }).click();
    await advance(page, 10_000);
    await page.getByRole('button', { name: 'Retour aux exercices' }).click();
    await expect(page).toHaveURL(/\/exercices$/);
    await expect(page.getByRole('region', { name: 'Séance en cours' })).toContainText('Séance en pause');
    await advance(page, 120_000, 10_000);
    await expect(page.getByRole('region', { name: 'Séance en cours' })).toContainText('00:10 de pratique active');
    await page.getByRole('region', { name: 'Séance en cours' }).getByRole('link', { name: /Reprendre/ }).click();
    await expect(page.getByText('04:50 restant')).toBeVisible();
  });

  test('an empty history loads cleanly everywhere', async ({ page }) => {
    for (const path of ['/', '/exercices', '/suivi', '/parametres', '/pratique']) {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
    }
    await expect(page).toHaveURL(/\/pratique\/respiration-lente$/);
  });
});
