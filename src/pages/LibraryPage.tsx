import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDocumentTitle } from '../app/hooks';
import { LiveSessionBanner } from '../components/LiveSessionBanner';
import { CATEGORIES, EXERCISES, getCategory, searchExercises, type Exercise } from '../domain/exercises';
import type { CategoryId } from '../domain/types';
import { PageLayout } from '../layout/AppShell';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';

function isCategory(value: string | null): value is CategoryId {
  return CATEGORIES.some((c) => c.id === value);
}

function ExerciseCard({ exercise, onDetails }: { exercise: Exercise; onDetails: () => void }) {
  const category = getCategory(exercise.category);
  const titleId = `card-${exercise.id}`;
  return (
    <article
      aria-labelledby={titleId}
      data-testid={`exercise-card-${exercise.id}`}
      className="flex flex-col justify-between rounded-2xl bg-surface-container-lowest p-space-md shadow-sm transition-all hover:shadow-md"
    >
      <div className="space-y-space-sm">
        <div className="flex items-center justify-between gap-space-xs">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-label-sm text-label-sm ${category.chipClass}`}>
            <Icon name={category.icon} size={13} />
            {category.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
            <Icon name={exercise.durationIcon} size={13} />
            {exercise.durationLabel}
          </span>
        </div>
        <div>
          <h3 id={titleId} className="font-headline-sm text-headline-sm text-primary">
            {exercise.title}
          </h3>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{exercise.summary}</p>
        </div>
        <ul className="flex flex-wrap items-center gap-2 py-1" aria-label="Points clés">
          {exercise.tags.map((tag) => (
            <li
              key={tag.label}
              className="inline-flex items-center gap-1 rounded-md bg-surface-container-low px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant"
            >
              <Icon name={tag.icon} size={14} className="text-secondary" />
              {tag.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-space-sm flex items-center gap-space-sm pt-space-md">
        <button
          type="button"
          onClick={onDetails}
          aria-label={`Détails : ${exercise.title}`}
          className="flex h-11 flex-1 items-center justify-center gap-1 rounded-full bg-surface-container-low px-3 font-label-md text-label-md text-on-primary-fixed-variant transition-colors hover:bg-surface-container"
        >
          <Icon name="info" size={18} />
          Détails
        </button>
        <Link
          to={`/pratique/${exercise.id}`}
          aria-label={`Commencer : ${exercise.title}`}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary-container px-4 font-label-md text-label-md text-on-primary shadow-sm transition-all hover:bg-secondary active:scale-95"
        >
          <Icon name="play_arrow" size={18} filled />
          Commencer
        </Link>
      </div>
    </article>
  );
}

export function LibraryPage() {
  useDocumentTitle('Exercices');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const rawCategory = params.get('categorie');
  const category: CategoryId | 'all' = isCategory(rawCategory) ? rawCategory : 'all';
  const [details, setDetails] = useState<Exercise | null>(null);

  const results = useMemo(() => searchExercises(query, category), [query, category]);
  const counts = useMemo(() => {
    const map = new Map<CategoryId | 'all', number>([['all', EXERCISES.length]]);
    for (const c of CATEGORIES) map.set(c.id, EXERCISES.filter((e) => e.category === c.id).length);
    return map;
  }, []);

  const update = (next: { q?: string; categorie?: CategoryId | 'all' }) => {
    const q = next.q ?? query;
    const cat = next.categorie ?? category;
    const search = new URLSearchParams();
    if (q) search.set('q', q);
    if (cat !== 'all') search.set('categorie', cat);
    setParams(search, { replace: true });
  };

  const chips: { id: CategoryId | 'all'; label: string }[] = [{ id: 'all', label: 'Tout' }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label }))];

  return (
    <PageLayout variant="tab" title="Exercices" wide>
      <div className="flex flex-col gap-space-md">
        <LiveSessionBanner />
        <div className="relative overflow-hidden rounded-2xl bg-surface-container-high p-space-md shadow-sm">
          <div className="relative z-10 flex items-start justify-between gap-space-sm">
            <div className="flex max-w-[75%] flex-col space-y-space-xs">
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-secondary-container/80 px-2.5 py-0.5 font-label-sm text-label-sm text-on-secondary-container">
                <Icon name="kid_star" size={14} />
                Bibliothèque d’exercices
              </span>
              <h2 className="font-headline-sm text-headline-sm text-primary">Trouvez votre équilibre</h2>
              <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
                {EXERCISES.length} pratiques douces de respiration, de relaxation et d’ancrage, à votre rythme.
              </p>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-secondary shadow-sm">
              <Icon name="self_improvement" size={26} />
            </span>
          </div>
        </div>

        <div className="sticky top-16 z-30 -mx-margin space-y-2.5 bg-surface/95 px-margin py-2 backdrop-blur-md lg:top-20">
          <div className="relative flex w-full items-center">
            <span className="pointer-events-none absolute left-3.5 flex items-center text-on-surface-variant">
              <Icon name="search" size={20} />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => update({ q: event.target.value })}
              aria-label="Rechercher un exercice"
              placeholder="Rechercher un exercice ou un bienfait…"
              className="h-12 w-full rounded-full bg-surface-container-lowest pl-11 pr-12 font-body-sm text-body-sm text-on-surface shadow-sm placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary"
            />
            {query ? (
              <button
                type="button"
                aria-label="Effacer la recherche"
                onClick={() => update({ q: '' })}
                className="absolute right-1.5 flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-container">
                  <Icon name="close" size={16} />
                </span>
              </button>
            ) : null}
          </div>
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-0.5" role="group" aria-label="Filtrer par catégorie">
            {chips.map((chip) => {
              const active = chip.id === category;
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update({ categorie: chip.id })}
                  className={`flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 font-label-md text-label-md shadow-sm transition-all ${
                    active ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span>{chip.label}</span>
                  <span
                    className={`rounded-full px-1.5 font-label-sm text-label-sm ${
                      active ? 'bg-surface-container-lowest/20' : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {counts.get(chip.id)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {results.length === 0 ? 'Aucun exercice trouvé' : `${results.length} exercice${results.length > 1 ? 's' : ''} affiché${results.length > 1 ? 's' : ''}`}
        </p>

        {results.length > 0 ? (
          <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 xl:grid-cols-3">
            {results.map((exercise) => (
              <ExerciseCard key={exercise.id} exercise={exercise} onDetails={() => setDetails(exercise)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-3 rounded-2xl bg-surface-container-lowest px-4 py-12 text-center shadow-sm">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
              <Icon name="filter_vintage" size={32} />
            </span>
            <h3 className="font-headline-sm text-headline-sm text-primary">Aucun exercice trouvé</h3>
            <p className="max-w-xs font-body-sm text-body-sm text-on-surface-variant">
              Essayez un mot-clé plus simple comme « 4s », « scan », « marche » ou réinitialisez les filtres.
            </p>
            <button
              type="button"
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
              className="h-11 rounded-full bg-secondary-container px-5 font-label-md text-label-md text-on-secondary-container hover:opacity-90"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}

        <footer className="mt-4 space-y-space-xs rounded-2xl bg-surface-container-low p-space-md shadow-sm">
          <div className="flex items-center gap-2 font-label-md text-label-md font-semibold text-primary">
            <Icon name="favorite" size={20} className="text-secondary" />
            Écoute du corps &amp; bienveillance
          </div>
          <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
            Ces exercices sont conçus pour votre bien-être au quotidien. Ne forcez jamais une rétention d’air ni une expiration. Si vous
            ressentez un quelconque étourdissement ou inconfort, revenez immédiatement à votre respiration naturelle et relâchez vos épaules.
          </p>
        </footer>
      </div>

      <Dialog open={details !== null} onClose={() => setDetails(null)} title={details?.title ?? ''} variant="sheet" showClose>
        {details ? (
          <div className="space-y-space-md">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 font-label-sm text-label-sm ${getCategory(details.category).chipClass}`}>
                {getCategory(details.category).label}
              </span>
              <span className="flex items-center gap-1 font-label-md text-label-md text-secondary">
                <Icon name="schedule" size={16} />
                {details.durationLabel}
              </span>
            </div>
            <div className="space-y-1 rounded-xl bg-surface-container-low p-space-sm">
              <h3 className="font-label-md text-label-md uppercase tracking-wider text-primary">Comment pratiquer</h3>
              <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">{details.instructions}</p>
            </div>
            <div className="space-y-1">
              <h3 className="font-label-md text-label-md uppercase tracking-wider text-primary">Bienfaits recherchés</h3>
              <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">{details.benefits}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDetails(null)}
                className="h-12 flex-1 rounded-full bg-surface-container font-label-md text-label-md text-on-surface hover:bg-surface-container-high"
              >
                Retour à la liste
              </button>
              <button
                type="button"
                onClick={() => navigate(`/exercices/${details.id}`)}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary-container font-label-md text-label-md text-on-primary shadow-sm hover:bg-secondary"
              >
                <Icon name="tune" size={20} />
                Configurer
              </button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </PageLayout>
  );
}
