import { advance, choose, expect, finishNow, installClock, storedHistory, test } from './fixtures';

test.describe('Scenario 1 — first visit', () => {
  test('home, library search & filter, exercise detail', async ({ page }) => {
    await installClock(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Prenez un moment pour vous.' })).toBeVisible();
    // No fabricated activity on a clean profile.
    await expect(page.getByTestId('week-minutes')).toHaveText('0');
    await expect(page.getByTestId('week-sessions')).toHaveText('0');
    await expect(page.getByText(/Aucune séance enregistrée cette semaine/)).toBeVisible();

    await page.getByRole('link', { name: 'Explorer les exercices' }).click();
    await expect(page).toHaveURL(/\/exercices$/);
    await expect(page.getByRole('article')).toHaveCount(10);

    await page.getByRole('searchbox', { name: 'Rechercher un exercice' }).fill('carrée');
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Respiration carrée' })).toBeVisible();
    await page.getByRole('button', { name: 'Effacer la recherche' }).click();

    await page.getByRole('button', { name: /^Relaxation corporelle/ }).click();
    await expect(page.getByRole('article')).toHaveCount(1);
    await page.getByRole('button', { name: /^Tout/ }).click();
    await expect(page.getByRole('article')).toHaveCount(10);

    await page.getByRole('button', { name: 'Détails : Respiration lente' }).click();
    const sheet = page.getByRole('dialog', { name: 'Respiration lente' });
    await expect(sheet.getByText(/Inspirez doucement par le nez pendant 4 secondes/)).toBeVisible();
    await sheet.getByRole('button', { name: 'Configurer' }).click();
    await expect(page).toHaveURL(/\/exercices\/respiration-lente$/);
    await expect(page.getByRole('heading', { name: 'Respiration lente', level: 2 })).toBeVisible();
    await expect(page.getByTestId('instructions')).toContainText('Inspirez doucement par le nez pendant 4 secondes');
  });
});

test.describe('Scenario 2 — complete a slow-breathing session', () => {
  test('configure, run, pause, resume, finish, reload', async ({ page }) => {
    await installClock(page);
    await page.goto('/exercices/respiration-lente');
    await choose(page, /^3 min/);
    await page.getByRole('button', { name: 'Démarrer la séance guidée' }).click();
    await expect(page).toHaveURL(/\/pratique\/respiration-lente$/);

    await expect(page.getByTestId('phase-badge')).toHaveText('Inspiration');
    await expect(page.getByTestId('remaining')).toHaveText('03:00');
    await advance(page, 2000);
    await expect(page.getByTestId('phase-count')).toHaveText('2s');
    await advance(page, 2000);
    await expect(page.getByTestId('phase-badge')).toHaveText('Expiration');
    await expect(page.getByTestId('breath-visual')).toHaveAttribute('data-phase', 'exhale');
    await advance(page, 26_000); // 30 s active

    await page.getByRole('button', { name: 'Mettre en pause' }).click();
    await expect(page.getByText('Respirez naturellement')).toBeVisible();
    await expect(page.getByText(/La minuterie est figée/)).toBeVisible();
    await advance(page, 15_000); // paused time must not count
    await expect(page.getByText('02:30 restant')).toBeVisible();

    await page.getByRole('button', { name: 'Reprendre la séance' }).click();
    await advance(page, 20_000);
    await page.getByRole('button', { name: 'Terminer' }).click();
    await finishNow(page);

    await expect(page.getByTestId('summary-status')).toHaveText('Séance terminée plus tôt');
    await expect(page.getByTestId('summary-active')).toHaveText('50 s');
    await expect(page.getByTestId('save-state')).toContainText('Séance enregistrée dans Mon suivi');
    let history = await storedHistory(page);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ exerciseId: 'respiration-lente', status: 'partial', activeSeconds: 50, pausedSeconds: 15 });

    await page.reload();
    history = await storedHistory(page);
    expect(history).toHaveLength(1);
    await page.goto('/suivi');
    await expect(page.getByTestId('session-list').getByRole('listitem')).toHaveCount(1);
    await expect(page.getByTestId('session-list')).toContainText('50 s');
    await expect(page.getByTestId('partial-count')).toHaveText('1');
  });

  test('a full session completes on time with exactly one record', async ({ page }) => {
    await installClock(page);
    await page.goto('/pratique/respiration-lente');
    await page.getByRole('button', { name: 'Commencer la séance' }).click();
    await advance(page, 300_000, 5000);
    await expect(page.getByTestId('summary-status')).toHaveText('Séance accomplie');
    await expect(page.getByTestId('summary-active')).toHaveText('5 min');
    await advance(page, 10_000);
    const history = await storedHistory(page);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ status: 'completed', activeSeconds: 300, cyclesCompleted: 30 });
  });
});

test.describe('Scenario 3 — restore a paused session after reload', () => {
  test('paused session is restored, resumed and completed without duplicates', async ({ page }) => {
    await installClock(page);
    await page.goto('/pratique/respiration-carree');
    await page.getByRole('button', { name: 'Commencer la séance' }).click();
    await advance(page, 21_000);
    await expect(page.getByTestId('cycle')).toContainText('Cycle 3 sur 30');
    await page.getByRole('button', { name: 'Mettre en pause' }).click();
    const remainingBefore = await page.getByTestId('remaining').textContent();
    expect(remainingBefore).toBe('03:39');

    await page.reload();
    await expect(page.getByText(/Séance restaurée et mise en pause/)).toBeVisible();
    await expect(page.getByTestId('remaining')).toHaveText('03:39');
    await expect(page.getByTestId('phase-badge')).toHaveText('Expiration'); // 21 s = 2 cycles of 8 s + 5 s
    await expect(page.getByRole('button', { name: 'Reprendre' })).toBeVisible();

    await page.getByRole('button', { name: 'Reprendre' }).click();
    await advance(page, 219_000, 5000);
    await expect(page.getByTestId('summary-status')).toHaveText('Séance accomplie');
    const history = await storedHistory(page);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ exerciseId: 'respiration-carree', status: 'completed', activeSeconds: 240 });
  });

  test('a running session refreshed mid-practice is restored paused at its last checkpoint', async ({ page }) => {
    await installClock(page);
    await page.goto('/pratique/respiration-lente');
    await page.getByRole('button', { name: 'Commencer la séance' }).click();
    await advance(page, 25_000);
    await page.reload(); // pagehide stores a final checkpoint
    await expect(page.getByText(/Séance restaurée et mise en pause/)).toBeVisible();
    await expect(page.getByText('04:35 restant')).toBeVisible();
    await advance(page, 60_000);
    await expect(page.getByText('04:35 restant')).toBeVisible();
    expect(await storedHistory(page)).toHaveLength(0);
  });
});
