import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readFileText } from '../../app/download';
import { HISTORY_KEY } from '../../storage/history';
import { makeRecord, renderApp, seedHistory, storedHistory, useFakeClock } from '../../test/renderApp';

const seed = () =>
  seedHistory([
    makeRecord('lente-1', new Date(2026, 9, 26, 8, 0), { activeSeconds: 300 }),
    makeRecord('scan-1', new Date(2026, 9, 24, 21, 0), { exerciseId: 'scan-corporel', activeSeconds: 600, unitsTotal: 8, unitsCompleted: 8, unitsSkipped: 0, cyclesCompleted: null, targetSeconds: null }),
    makeRecord('lente-2', new Date(2026, 9, 20, 7, 30), { status: 'partial', activeSeconds: 90, pausedSeconds: 40 }),
  ]);

describe('Mon suivi', () => {
  it('shows an empty state without fabricated numbers', () => {
    useFakeClock();
    renderApp('/suivi');
    expect(screen.getByRole('heading', { name: 'Aucune séance enregistrée' })).toBeInTheDocument();
    expect(screen.getByTestId('total-minutes')).toHaveTextContent('0');
    expect(screen.getByTestId('completed-count')).toHaveTextContent('0');
    expect(screen.getByRole('button', { name: 'Exporter en CSV' })).toBeDisabled();
  });

  it('computes totals from stored records (partial time counted, not as completed)', () => {
    useFakeClock();
    seed();
    renderApp('/suivi');
    expect(screen.getByTestId('total-minutes')).toHaveTextContent('16'); // 990 s
    expect(screen.getByTestId('completed-count')).toHaveTextContent('2');
    expect(screen.getByTestId('partial-count')).toHaveTextContent('1');
    expect(screen.getByTestId('week-minutes')).toHaveTextContent('5');
    expect(within(screen.getByTestId('session-list')).getAllByRole('listitem')).toHaveLength(3);
  });

  it('filters by exercise and by date range', async () => {
    useFakeClock();
    seed();
    const { user } = renderApp('/suivi');
    await user.selectOptions(screen.getByLabelText('Exercice'), 'scan-corporel');
    expect(within(screen.getByTestId('session-list')).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByTestId('filtered-summary')).toHaveTextContent('1 séance · 10 min');
    await user.selectOptions(screen.getByLabelText('Exercice'), 'all');
    await user.type(screen.getByLabelText('Du'), '2026-10-21');
    await user.type(screen.getByLabelText('Au'), '2026-10-25');
    expect(within(screen.getByTestId('session-list')).getAllByRole('listitem')).toHaveLength(1);
    await user.clear(screen.getByLabelText('Du'));
    await user.type(screen.getByLabelText('Du'), '2026-10-26');
    expect(screen.getByRole('alert')).toHaveTextContent('La date de début doit précéder la date de fin.');
    await user.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    expect(within(screen.getByTestId('session-list')).getAllByRole('listitem')).toHaveLength(3);
  });

  it('shows session details and deletes a session after confirmation', async () => {
    useFakeClock();
    seed();
    const { user } = renderApp('/suivi');
    await user.click(within(screen.getByTestId('session-list')).getAllByRole('button')[2]!);
    const dialog = screen.getByRole('dialog', { name: 'Respiration lente' });
    expect(dialog).toHaveTextContent('1 min 30');
    expect(dialog).toHaveTextContent('Terminée plus tôt');
    expect(dialog).toHaveTextContent('Pauses (non comptées)');
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer cette séance' }));
    await user.click(within(dialog).getByRole('button', { name: 'Confirmer la suppression' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('partial-count')).toHaveTextContent('0');
    expect(storedHistory().map((r) => r.id)).toEqual(['lente-1', 'scan-1']);
  });

  it('exports CSV and JSON files built from the stored history', async () => {
    useFakeClock();
    seed();
    const blobs: Blob[] = [];
    const create = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:test';
    });
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    const clicks = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { user } = renderApp('/suivi');
    await user.click(screen.getByRole('button', { name: 'Exporter en CSV' }));
    await user.click(screen.getByRole('button', { name: 'Sauvegarde JSON' }));
    expect(clicks).toHaveBeenCalledTimes(2);
    const csv = await readFileText(blobs[0]!);
    expect(csv.split('\r\n')[0]).toContain('exercice_id');
    expect(csv).toContain('Scan corporel bienveillant');
    const json = JSON.parse(await readFileText(blobs[1]!)) as { sessions: { id: string }[] };
    expect(json.sessions.map((s) => s.id)).toEqual(['lente-1', 'scan-1', 'lente-2']);
    expect(screen.getByText('Export JSON préparé : 3 séances.')).toBeInTheDocument();
  });

  it('isolates unreadable records and reports them', () => {
    useFakeClock();
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify({ schemaVersion: 1, sessions: [makeRecord('ok', new Date(2026, 9, 26, 8, 0)), { broken: true }] }));
    renderApp('/suivi');
    expect(screen.getByText(/1 enregistrement illisible a été mis de côté/)).toBeInTheDocument();
    expect(screen.getByTestId('total-minutes')).toHaveTextContent('5');
  });

  it('survives completely corrupt storage', () => {
    window.localStorage.setItem(HISTORY_KEY, '{{{');
    window.localStorage.setItem('calme.preferences', 'nope');
    renderApp('/parametres');
    expect(screen.getByText(/L'historique enregistré était illisible/)).toBeInTheDocument();
    expect(screen.getByText(/Vos préférences étaient illisibles/)).toBeInTheDocument();
  });
});

describe('Paramètres', () => {
  it('validates and saves the weekly goal', async () => {
    const { user } = renderApp('/parametres');
    const input = screen.getByLabelText('Minutes de pratique par semaine');
    await user.clear(input);
    await user.type(input, '2');
    await user.click(screen.getByRole('button', { name: "Enregistrer l'objectif" }));
    expect(screen.getByRole('alert')).toHaveTextContent('entre 5 et 1000');
    await user.clear(input);
    await user.type(input, '90');
    await user.click(screen.getByRole('button', { name: "Enregistrer l'objectif" }));
    expect(screen.getByText('Objectif enregistré : 90 minutes par semaine.')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('calme.preferences')!)).toMatchObject({ weeklyGoalMinutes: 90 });
  });

  it('switches persist (sound, reduced motion, history recording)', async () => {
    const { user } = renderApp('/parametres');
    await user.click(screen.getByRole('switch', { name: 'Guide sonore' }));
    await user.click(screen.getByRole('radio', { name: 'Toujours réduits' }));
    await user.click(screen.getByRole('switch', { name: 'Enregistrer mes séances dans Mon suivi' }));
    expect(JSON.parse(window.localStorage.getItem('calme.preferences')!)).toMatchObject({ sound: false, motion: 'reduce', recordHistory: false });
    expect(document.querySelector('.reduce-motion')).not.toBeNull();
  });

  it('deletes the whole history after confirmation, and can cancel', async () => {
    seed();
    const { user } = renderApp('/parametres');
    expect(screen.getByText('3 séances enregistrées.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "Supprimer tout l'historique" }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annuler' }));
    expect(storedHistory()).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: "Supprimer tout l'historique" }));
    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }));
    expect(screen.getByText("L'historique a été supprimé.")).toBeInTheDocument();
    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
    expect(screen.getByText('0 séance enregistrée.')).toBeInTheDocument();
  });

  it('imports a backup after confirmation, merging and ignoring duplicates', async () => {
    seedHistory([makeRecord('lente-1', new Date(2026, 9, 26, 8, 0))]);
    const { user } = renderApp('/parametres');
    const backup = {
      app: 'calme',
      kind: 'historique',
      schemaVersion: 1,
      exportedAt: '2026-10-26T10:00:00.000Z',
      sessions: [makeRecord('lente-1', new Date(2026, 9, 26, 8, 0)), makeRecord('nouveau', new Date(2026, 9, 25, 8, 0)), { id: 'x' }],
    };
    const file = new File([JSON.stringify(backup)], 'calme.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Importer une sauvegarde JSON'), file);
    const dialog = await screen.findByRole('dialog', { name: 'Importer cette sauvegarde ?' });
    expect(within(dialog).getByTestId('import-new')).toHaveTextContent('1 séance(s) seront ajoutées.');
    expect(dialog).toHaveTextContent('1 séance(s) déjà présentes seront ignorées.');
    expect(dialog).toHaveTextContent('1 entrée(s) invalide(s) ignorée(s).');
    await user.click(within(dialog).getByRole('button', { name: "Confirmer l'import" }));
    expect(screen.getByText(/Import terminé : 1 séance\(s\) ajoutée\(s\), 1 doublon/)).toBeInTheDocument();
    expect(storedHistory().map((r) => r.id).sort()).toEqual(['lente-1', 'nouveau']);
  });

  it('cancelling an import changes nothing; invalid files are rejected with a message', async () => {
    const { user } = renderApp('/parametres');
    const valid = new File([JSON.stringify({ app: 'calme', kind: 'historique', schemaVersion: 1, sessions: [makeRecord('a', new Date(2026, 9, 25))] })], 'a.json', {
      type: 'application/json',
    });
    await user.upload(screen.getByLabelText('Importer une sauvegarde JSON'), valid);
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annuler' }));
    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
    await user.upload(screen.getByLabelText('Importer une sauvegarde JSON'), new File(['pas du json'], 'b.json', { type: 'application/json' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Ce fichier n'est pas un JSON valide");
    await user.upload(
      screen.getByLabelText('Importer une sauvegarde JSON'),
      new File([JSON.stringify({ app: 'calme', kind: 'historique', schemaVersion: 7, sessions: [] })], 'c.json', { type: 'application/json' }),
    );
    expect(await screen.findByText(/Version de sauvegarde non prise en charge \(7\)/)).toBeInTheDocument();
  });

  it('reports a failed preference write without crashing', async () => {
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === 'calme.preferences') {
        const error = new Error('quota');
        error.name = 'QuotaExceededError';
        throw error;
      }
      return original.call(this, key, value);
    });
    const { user } = renderApp('/parametres');
    await user.click(screen.getByRole('button', { name: "Enregistrer l'objectif" }));
    expect(screen.getByRole('alert')).toHaveTextContent(/stockage de votre navigateur est plein/);
    spy.mockRestore();
  });
});
