import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HISTORY_KEY } from '../../storage/history';
import { ACTIVE_SESSION_KEY } from '../../storage/activeSession';
import { advance, renderApp, storedHistory, useFakeClock } from '../../test/renderApp';

async function startSlow(user: ReturnType<typeof renderApp>['user']) {
  await user.click(screen.getByRole('button', { name: 'Commencer la séance' }));
}

describe('slow breathing practice', () => {
  it('runs inhale → exhale from the same timing source and counts down', async () => {
    useFakeClock();
    const { user } = renderApp('/pratique/respiration-lente');
    await startSlow(user);
    expect(screen.getByTestId('phase-badge')).toHaveTextContent('Inspiration');
    expect(screen.getByTestId('phase-count')).toHaveTextContent('4s');
    expect(screen.getByTestId('cycle')).toHaveTextContent('1 / 30');
    await advance(1000);
    expect(screen.getByTestId('phase-count')).toHaveTextContent('3s');
    const visual = screen.getByTestId('breath-visual');
    expect(visual).toHaveAttribute('data-phase', 'inhale');
    await advance(3000);
    expect(screen.getByTestId('phase-badge')).toHaveTextContent('Expiration');
    expect(visual).toHaveAttribute('data-phase', 'exhale');
    expect(screen.getByTestId('phase-count')).toHaveTextContent('6s');
    await advance(6000);
    expect(screen.getByTestId('cycle')).toHaveTextContent('2 / 30');
    expect(screen.getByTestId('remaining')).toHaveTextContent('04:50');
  });

  it('30 s active + 10 s paused + 20 s active is recorded as 50 s', async () => {
    useFakeClock();
    const { user } = renderApp('/pratique/respiration-lente');
    await startSlow(user);
    await advance(30_000, 1000);
    await user.click(screen.getByRole('button', { name: 'Mettre en pause' }));
    expect(screen.getByText('Respirez naturellement')).toBeInTheDocument();
    expect(screen.getByText(/La minuterie est figée/)).toBeInTheDocument();
    await advance(10_000, 1000);
    expect(screen.getByText(/04:30 restant/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reprendre la séance' }));
    await advance(20_000, 1000);
    await user.click(screen.getByRole('button', { name: 'Terminer' }));
    const dialog = screen.getByRole('dialog', { name: 'Terminer la séance maintenant ?' });
    await user.click(within(dialog).getByRole('button', { name: 'Terminer et enregistrer' }));
    expect(screen.getByTestId('summary-status')).toHaveTextContent('Séance terminée plus tôt');
    expect(screen.getByTestId('summary-active')).toHaveTextContent('50 s');
    expect(screen.getByTestId('save-state')).toHaveTextContent('Séance enregistrée dans Mon suivi');
    const history = storedHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ status: 'partial', activeSeconds: 50, pausedSeconds: 10, exerciseId: 'respiration-lente' });
    expect(window.localStorage.getItem(ACTIVE_SESSION_KEY)).toBeNull();
  });

  it('completes at the configured duration and records exactly one session', async () => {
    useFakeClock();
    const { user } = renderApp('/pratique/respiration-lente');
    await startSlow(user);
    await advance(300_000, 5000);
    expect(screen.getByTestId('summary-status')).toHaveTextContent('Séance accomplie');
    expect(screen.getByTestId('summary-active')).toHaveTextContent('5 min');
    expect(screen.getByTestId('summary-units')).toHaveTextContent('30');
    await advance(5000);
    expect(storedHistory()).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /Posé & calme/ }));
    expect(storedHistory()[0]).toMatchObject({ status: 'completed', activeSeconds: 300, feeling: 'calme' });
    expect(storedHistory()).toHaveLength(1);
  });

  it('cancelling never creates a record', async () => {
    useFakeClock();
    const { user } = renderApp('/pratique/respiration-lente');
    await startSlow(user);
    await advance(20_000, 1000);
    await user.click(screen.getByRole('button', { name: 'Terminer' }));
    await user.click(screen.getByRole('button', { name: 'Abandonner sans enregistrer' }));
    expect(screen.getByRole('button', { name: 'Commencer la séance' })).toBeInTheDocument();
    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
    expect(window.localStorage.getItem(ACTIVE_SESSION_KEY)).toBeNull();
  });

  it('"Continuer la pratique" keeps the session running', async () => {
    useFakeClock();
    const { user } = renderApp('/pratique/respiration-lente');
    await startSlow(user);
    await user.click(screen.getByRole('button', { name: 'Terminer' }));
    await user.click(screen.getByRole('button', { name: 'Continuer la pratique' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mettre en pause' })).toBeInTheDocument();
  });

  it('restart asks for confirmation and starts again from zero', async () => {
    useFakeClock();
    const { user } = renderApp('/pratique/respiration-lente');
    await startSlow(user);
    await advance(42_000, 1000);
    await user.click(screen.getByRole('button', { name: 'Repartir' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Recommencer' }));
    expect(screen.getByTestId('remaining')).toHaveTextContent('05:00');
    expect(screen.getByTestId('cycle')).toHaveTextContent('1 / 30');
    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
  });

  it('Space toggles pause / resume', async () => {
    useFakeClock();
    const { user } = renderApp('/pratique/respiration-lente');
    await startSlow(user);
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(document.body, { key: ' ', code: 'Space' });
    expect(await screen.findByText('Respirez naturellement')).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: ' ', code: 'Space' });
    expect(screen.getByRole('button', { name: 'Mettre en pause' })).toBeInTheDocument();
  });

  it('announces phase changes only (never the per-second countdown)', async () => {
    useFakeClock();
    const { user } = renderApp('/pratique/respiration-lente');
    await startSlow(user);
    const announcer = screen.getByTestId('announcer');
    expect(announcer).toHaveTextContent('Inspiration');
    await advance(2000);
    expect(announcer).toHaveTextContent('Inspiration');
    await advance(2000);
    expect(announcer).toHaveTextContent('Expiration');
    expect(screen.getByTestId('phase-count')).toHaveAttribute('aria-hidden', 'true');
  });

  it('settings pause the session and apply a new cadence', async () => {
    useFakeClock();
    const { user } = renderApp('/pratique/respiration-lente');
    await startSlow(user);
    await advance(5000);
    await user.click(screen.getByRole('button', { name: 'Paramètres de respiration' }));
    const dialog = screen.getByRole('dialog', { name: 'Réglages de la séance' });
    await user.click(within(within(dialog).getByRole('group', { name: /Durée d'expiration/ })).getByRole('radio', { name: '8s' }));
    await user.click(within(dialog).getByRole('button', { name: 'Appliquer et reprendre' }));
    // Paused mid-cycle → the new cadence restarts with an inhalation.
    expect(screen.getByTestId('phase-badge')).toHaveTextContent('Inspiration');
    await advance(4000);
    expect(screen.getByTestId('phase-count')).toHaveTextContent('8s');
  });

  it('reduced motion keeps the breathing visual still', async () => {
    useFakeClock();
    window.localStorage.setItem('calme.preferences', JSON.stringify({ schemaVersion: 1, motion: 'reduce' }));
    const { user } = renderApp('/pratique/respiration-lente');
    await startSlow(user);
    await advance(2000);
    expect(screen.getByTestId('breath-visual')).toHaveAttribute('data-scale', '1.000');
    expect(screen.getByTestId('phase-badge')).toHaveTextContent('Inspiration');
  });

  it('a storage write failure is reported and can be retried', async () => {
    useFakeClock();
    const { user } = renderApp('/pratique/respiration-lente');
    await startSlow(user);
    await advance(30_000, 1000);
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === HISTORY_KEY) {
        const error = new Error('quota');
        error.name = 'QuotaExceededError';
        throw error;
      }
      return original.call(this, key, value);
    });
    await user.click(screen.getByRole('button', { name: 'Terminer' }));
    await user.click(screen.getByRole('button', { name: 'Terminer et enregistrer' }));
    expect(screen.getByTestId('save-state')).toHaveTextContent(/n’a pas pu être enregistrée.*plein/);
    spy.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Réessayer l’enregistrement' }));
    expect(screen.getByTestId('save-state')).toHaveTextContent('Séance enregistrée');
    expect(storedHistory()).toHaveLength(1);
  });

  it('respects the privacy setting that disables history', async () => {
    useFakeClock();
    window.localStorage.setItem('calme.preferences', JSON.stringify({ schemaVersion: 1, recordHistory: false }));
    const { user } = renderApp('/pratique/respiration-lente');
    await startSlow(user);
    await advance(10_000, 1000);
    await user.click(screen.getByRole('button', { name: 'Terminer' }));
    await user.click(screen.getByRole('button', { name: 'Terminer et enregistrer' }));
    expect(screen.getByTestId('save-state')).toHaveTextContent(/désactivé/);
    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
  });
});

describe('session persistence across navigation and reload', () => {
  it('navigating away pauses the session and the home banner offers to resume', async () => {
    useFakeClock();
    const { user } = renderApp('/pratique/respiration-lente');
    await startSlow(user);
    await advance(12_000, 1000);
    await user.click(screen.getByRole('button', { name: 'Retour aux exercices' }));
    const banner = screen.getByRole('region', { name: 'Séance en cours' });
    expect(banner).toHaveTextContent('Séance en pause : Respiration lente');
    expect(banner).toHaveTextContent('00:12 de pratique active');
    await advance(60_000, 5000);
    await user.click(within(banner).getByRole('link', { name: /Reprendre/ }));
    expect(screen.getByText(/04:48 restant/)).toBeInTheDocument();
  });

  it('a reload restores the session paused, crediting only time before the last checkpoint', async () => {
    useFakeClock();
    const first = renderApp('/pratique/respiration-lente');
    await startSlow(first.user);
    await advance(25_000, 1000); // checkpoints at ~10 s and ~20 s
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    first.unmount();
    await advance(120_000, 10_000); // page closed for two minutes
    renderApp('/pratique/respiration-lente');
    expect(screen.getByText(/Séance restaurée et mise en pause/)).toBeInTheDocument();
    expect(screen.getByText(/04:35 restant/)).toBeInTheDocument();
    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
  });
});

describe('guided exercises', () => {
  it('grounding progresses 5 → 1 and never stores personal observations', async () => {
    useFakeClock();
    const { user } = renderApp('/pratique/ancrage-sensoriel');
    await user.click(screen.getByRole('button', { name: "Commencer l'ancrage" }));
    expect(screen.getByTestId('grounding-count')).toHaveTextContent('5');
    await user.type(screen.getByLabelText('Ajouter une observation personnelle'), 'Mon carnet secret');
    await user.click(screen.getByRole('button', { name: 'Retenir' }));
    expect(screen.getByRole('button', { name: 'Mon carnet secret' })).toHaveAttribute('aria-pressed', 'true');
    const counts: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      counts.push(screen.getByTestId('grounding-count').textContent ?? '');
      await advance(3000, 1000);
      await user.click(screen.getByRole('button', { name: i === 4 ? /Compléter la séance/ : /^Suivant/ }));
    }
    expect(counts).toEqual(['5', '4', '3', '2', '1']);
    expect(screen.getByTestId('summary-units')).toHaveTextContent('5 / 5');
    const dump = JSON.stringify({ ...window.localStorage });
    expect(dump).not.toContain('carnet secret');
  });

  it('muscle relaxation: groups change, a group can be skipped, pause/resume works', async () => {
    useFakeClock();
    const { user } = renderApp('/pratique/relaxation-musculaire');
    await user.click(screen.getByRole('button', { name: 'Commencer la séance' }));
    expect(screen.getByTestId('group-title')).toHaveTextContent('Mains et poignets');
    expect(screen.getByTestId('phase-badge')).toHaveTextContent('Contraction douce');
    await advance(5000);
    expect(screen.getByTestId('phase-badge')).toHaveTextContent('Relâchement complet');
    await user.click(screen.getByRole('button', { name: 'Passer cette zone' }));
    expect(screen.getByTestId('group-title')).toHaveTextContent('Bras et avant-bras');
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Reprendre' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reprendre' }));
    await user.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    await user.click(screen.getByRole('button', { name: 'Terminer et enregistrer' }));
    expect(storedHistory()[0]).toMatchObject({ exerciseId: 'relaxation-musculaire', status: 'partial', unitsSkipped: 1, unitsCompleted: 0, unitsTotal: 7 });
  });

  it('humming counts repetitions with "Répétition terminée"', async () => {
    useFakeClock();
    const { user } = renderApp('/pratique/expiration-fredonnement');
    await user.click(screen.getByRole('button', { name: 'Commencer la séance' }));
    expect(screen.getByTestId('repetition')).toHaveTextContent('Répétition 1 sur 5');
    await user.click(screen.getByRole('button', { name: 'Répétition terminée' }));
    await user.click(screen.getByRole('button', { name: 'Passer ce cycle' }));
    expect(screen.getByTestId('repetition')).toHaveTextContent('Répétition 3 sur 5');
  });

  it('walking shows prompts without imposing a breathing rhythm', async () => {
    useFakeClock();
    const { user } = renderApp('/pratique/marche-attentive');
    await user.click(screen.getByRole('radio', { name: /^5\s*minutes/ }));
    await user.click(screen.getByRole('button', { name: 'Commencer la marche' }));
    expect(screen.getByTestId('breathing-mode')).toHaveTextContent('aucun rythme imposé');
    expect(screen.getByTestId('prompt-text')).toHaveTextContent('Remarquez le contact de vos pieds avec le sol.');
    await user.click(screen.getByRole('button', { name: /Invite suivante/ }));
    expect(screen.getByTestId('prompt-counter')).toHaveTextContent('Invite 2 sur 5');
    expect(screen.getByTestId('remaining')).toHaveTextContent('05:00');
  });
});
