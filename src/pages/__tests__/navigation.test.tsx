import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TEST_NOW, makeRecord, renderApp, seedHistory, useFakeClock } from '../../test/renderApp';

describe('home screen', () => {
  it('loads with navigation and presents no fabricated statistics', () => {
    useFakeClock();
    renderApp('/');
    expect(screen.getByRole('heading', { name: 'Prenez un moment pour vous.' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    for (const label of ['Accueil', 'Exercices', 'Pratique', 'Mon suivi', 'Paramètres']) {
      expect(within(nav).getByRole('link', { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(screen.getByTestId('week-minutes')).toHaveTextContent('0');
    expect(screen.getByTestId('week-sessions')).toHaveTextContent('0');
    expect(screen.getByText(/Aucune séance enregistrée cette semaine/)).toBeInTheDocument();
    expect(screen.queryByText(/Pratique privilégiée/)).not.toBeInTheDocument();
  });

  it('shows real weekly totals from stored sessions', () => {
    useFakeClock();
    seedHistory([
      makeRecord('a', new Date(2026, 9, 26, 8, 0), { activeSeconds: 600 }),
      makeRecord('b', new Date(2026, 9, 26, 9, 0), { exerciseId: 'scan-corporel', activeSeconds: 300 }),
      makeRecord('old', new Date(2026, 9, 19, 9, 0), { activeSeconds: 900 }), // previous week
    ]);
    renderApp('/');
    expect(screen.getByTestId('week-minutes')).toHaveTextContent('15');
    expect(screen.getByTestId('week-sessions')).toHaveTextContent('2');
    expect(screen.getByText('Pratique privilégiée cette semaine').nextElementSibling).toHaveTextContent('Respiration lente');
    expect(screen.getByText('67 %')).toBeInTheDocument();
    expect(TEST_NOW.getDay()).toBe(1);
  });

  it('primary actions navigate to real destinations', async () => {
    useFakeClock();
    const { user } = renderApp('/');
    await user.click(screen.getByRole('link', { name: 'Explorer les exercices' }));
    expect(screen.getByRole('heading', { name: 'Trouvez votre équilibre' })).toBeInTheDocument();
  });

  it('"Commencer une séance" opens the recommended exercise ready to start', async () => {
    useFakeClock();
    const { user } = renderApp('/');
    await user.click(screen.getByRole('link', { name: 'Commencer une séance' }));
    expect(screen.getByRole('heading', { name: 'Respiration lente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commencer la séance' })).toBeInTheDocument();
  });

  it('"Lancer la routine" starts the routine on slow breathing', async () => {
    useFakeClock();
    const { user } = renderApp('/');
    await user.click(screen.getByRole('link', { name: /Lancer la routine/ }));
    expect(screen.getByText(/Routine « Parenthèse d’apaisement »/)).toBeInTheDocument();
  });

  it('unknown routes show a helpful page', () => {
    renderApp('/nulle-part');
    expect(screen.getByRole('heading', { name: 'Cette page n’existe pas' })).toBeInTheDocument();
    renderApp('/pratique/inconnu');
    expect(screen.getAllByRole('heading', { name: 'Cette page n’existe pas' }).length).toBeGreaterThan(0);
  });
});

describe('exercise library', () => {
  it('lists the ten exercises', () => {
    renderApp('/exercices');
    expect(screen.getAllByRole('article')).toHaveLength(10);
  });

  it('searches by keyword', async () => {
    const { user } = renderApp('/exercices');
    await user.type(screen.getByRole('searchbox', { name: 'Rechercher un exercice' }), 'marche');
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(1);
    expect(within(cards[0]!).getByRole('heading', { name: 'Marche attentive' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Effacer la recherche' }));
    expect(screen.getAllByRole('article')).toHaveLength(10);
  });

  it('filters by category and shows counts', async () => {
    const { user } = renderApp('/exercices');
    const chip = screen.getByRole('button', { name: /Relaxation corporelle/ });
    expect(chip).toHaveTextContent('1');
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /Attention & Ancrage/ }));
    expect(screen.getAllByRole('article').map((a) => within(a).getByRole('heading').textContent)).toEqual([
      'Scan corporel bienveillant',
      'Ancrage sensoriel 5-4-3-2-1',
    ]);
  });

  it('shows an empty state that can reset the filters', async () => {
    const { user } = renderApp('/exercices');
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByRole('heading', { name: 'Aucun exercice trouvé' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    expect(screen.getAllByRole('article')).toHaveLength(10);
  });

  it('opens an accessible details sheet that closes with Escape', async () => {
    const { user } = renderApp('/exercices');
    await user.click(screen.getByRole('button', { name: 'Détails : Respiration carrée' }));
    const dialog = screen.getByRole('dialog', { name: 'Respiration carrée' });
    expect(within(dialog).getByText(/Visualisez un carré/)).toBeInTheDocument();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Détails : Respiration carrée' })).toHaveFocus();
  });

  it('"Configurer" in the details sheet opens the detail page', async () => {
    const { user } = renderApp('/exercices');
    await user.click(screen.getByRole('button', { name: 'Détails : Scan corporel bienveillant' }));
    await user.click(screen.getByRole('button', { name: 'Configurer' }));
    expect(screen.getByRole('heading', { name: 'Scan corporel bienveillant' })).toBeInTheDocument();
    expect(screen.getByTestId('instructions')).toHaveTextContent(/faisceau lumineux chaud/);
  });

  it('"Commencer" on a card opens the practice screen', async () => {
    const { user } = renderApp('/exercices');
    await user.click(screen.getByRole('link', { name: 'Commencer : Marche attentive' }));
    expect(screen.getByRole('button', { name: 'Commencer la marche' })).toBeInTheDocument();
  });
});

describe('exercise detail', () => {
  it('saves the configuration and starts the session', async () => {
    useFakeClock();
    const { user } = renderApp('/exercices/respiration-lente');
    expect(screen.getByRole('heading', { name: 'Respiration lente' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /3 min/ }));
    await user.click(within(screen.getByRole('group', { name: /Durée d'inspiration/ })).getByRole('radio', { name: '5s' }));
    await user.click(screen.getByRole('button', { name: 'Démarrer la séance guidée' }));
    expect(screen.getByTestId('remaining')).toHaveTextContent('03:00');
    expect(screen.getByTestId('phase-badge')).toHaveTextContent('Inspiration');
    const prefs = JSON.parse(window.localStorage.getItem('calme.preferences')!) as { exerciseConfigs: Record<string, { durationSec: number; inhaleSec: number }> };
    expect(prefs.exerciseConfigs['respiration-lente']).toMatchObject({ durationSec: 180, inhaleSec: 5 });
  });

  it('validates a custom duration', async () => {
    const { user } = renderApp('/exercices/respiration-lente');
    await user.click(screen.getByRole('radio', { name: 'Personnalisé' }));
    const input = screen.getByLabelText('Durée personnalisée (minutes)');
    await user.clear(input);
    await user.type(input, '0');
    expect(screen.getByRole('alert')).toHaveTextContent(/entre 1 et 60/);
    await user.clear(input);
    await user.type(input, '2');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('muscle relaxation lets the user exclude a sensitive zone', async () => {
    const { user } = renderApp('/exercices/relaxation-musculaire');
    await user.click(screen.getByRole('checkbox', { name: 'Inclure : Pieds et orteils' }));
    expect(screen.getByText('Zone passée')).toBeInTheDocument();
  });
});
