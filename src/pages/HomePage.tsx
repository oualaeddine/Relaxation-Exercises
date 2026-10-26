import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import routineImage from '../assets/routine-sanctuaire.jpg';
import { useAppData } from '../app/AppData';
import { useDocumentTitle } from '../app/hooks';
import { LiveSessionBanner } from '../components/LiveSessionBanner';
import { WeeklyChart } from '../components/WeeklyChart';
import { getExercise, SAFETY_NOTE } from '../domain/exercises';
import { wholeMinutes } from '../domain/format';
import { ROUTINE } from '../domain/routine';
import { computeStats } from '../domain/stats';
import type { ExerciseId } from '../domain/types';
import { PageLayout } from '../layout/AppShell';
import { Icon, type IconName } from '../ui/Icon';
import { SafetyNote } from '../ui/controls';

const QUICK: { id: ExerciseId; label: string; duration: string; subtitle: string; icon: IconName; tone: string }[] = [
  { id: 'respiration-lente', label: 'Respiration', duration: '5 min', subtitle: 'Cadence apaisante : 4s inspire / 6s expire', icon: 'air', tone: 'bg-secondary-container/70 text-secondary' },
  { id: 'soupir-physiologique', label: 'Apaisement', duration: '1 min', subtitle: 'Relâcher une montée de tension', icon: 'cloud', tone: 'bg-surface-container text-primary' },
  { id: 'expiration-levres-pincees', label: 'Souffle doux', duration: '2 min', subtitle: "Réguler le flux d'air en douceur", icon: 'filter_drama', tone: 'bg-surface-container-high text-primary' },
  { id: 'relaxation-musculaire', label: 'Détente corporelle', duration: '≈ 8 min', subtitle: 'Contraction douce puis relâchement', icon: 'bed', tone: 'bg-secondary-container/60 text-secondary' },
];

export function HomePage() {
  useDocumentTitle('Accueil');
  const { records, preferences } = useAppData();
  const stats = useMemo(() => computeStats(records, new Date(), preferences.weeklyGoalMinutes), [records, preferences.weeklyGoalMinutes]);
  const weekMinutes = wholeMinutes(stats.weekSeconds);
  const sevenDaySeconds = stats.last7Days.reduce((sum, d) => sum + d.seconds, 0);
  const averageMinutes = Math.round(sevenDaySeconds / 60 / 7);
  const favorite = stats.weekFavorite ? getExercise(stats.weekFavorite.exerciseId) : null;
  const hasWeek = stats.weekSessions > 0;

  return (
    <PageLayout variant="tab" title="Accueil">
      <div className="flex w-full flex-col gap-space-lg">
        <LiveSessionBanner />

        <section className="flex flex-col gap-space-sm pt-space-xs" aria-labelledby="home-title">
          <div className="inline-flex items-center gap-space-xs self-start rounded-full bg-secondary-container/50 px-space-sm py-1 text-on-secondary-container shadow-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-secondary" />
            <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wide">Pause régénératrice</span>
          </div>
          <h2 id="home-title" className="font-display-mobile text-display-mobile leading-tight tracking-tight text-primary lg:text-display">
            Prenez un moment pour vous.
          </h2>
          <p className="max-w-lg font-body-md text-body-md leading-relaxed text-on-surface-variant">
            Quelques minutes de pratique pour ralentir, relâcher les tensions et retrouver votre calme.
          </p>
          <div className="flex flex-col items-stretch gap-space-sm pt-space-xs xs:flex-row">
            <Link
              to="/pratique"
              className="flex h-14 items-center justify-center gap-space-xs rounded-full bg-primary-container px-space-lg font-label-lg text-label-lg text-on-primary shadow-md transition-all hover:bg-secondary active:scale-[0.98]"
            >
              <Icon name="air" size={20} filled />
              Commencer une séance
            </Link>
            <Link
              to="/exercices"
              className="flex h-14 items-center justify-center gap-space-xs rounded-full bg-surface-container-low px-space-lg font-label-lg text-label-lg text-primary shadow-sm transition-all hover:bg-surface-container active:scale-[0.98]"
            >
              <Icon name="explore" size={20} />
              Explorer les exercices
            </Link>
          </div>
        </section>

        <section className="relative flex flex-col gap-space-md overflow-hidden rounded-lg bg-surface-container-lowest p-space-lg shadow-sm" aria-labelledby="routine-title">
          <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-bl-full bg-gradient-to-bl from-secondary-container/40 via-surface-container/20 to-transparent" />
          <div className="relative z-10 flex items-start justify-between gap-space-sm">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-space-xs">
                <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-secondary">Routine du jour</span>
                <span className="text-label-sm text-on-surface-variant" aria-hidden="true">
                  •
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Séquence guidée</span>
              </div>
              <h2 id="routine-title" className="font-headline-sm text-headline-sm text-on-surface">
                {ROUTINE.title}
              </h2>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-secondary-container px-3 py-1 font-label-md text-label-md text-on-secondary-container shadow-sm">
              <Icon name="schedule" size={16} />
              10 min
            </span>
          </div>
          <div className="relative h-32 w-full overflow-hidden rounded bg-surface-container-low">
            <img
              className="h-full w-full object-cover"
              src={routineImage}
              alt="Un coin de méditation lumineux en bois clair, avec un coussin en lin et des feuilles d'eucalyptus."
              width={512}
              height={279}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent" />
            <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-primary/70 px-2.5 py-1 font-label-sm text-label-sm text-on-primary backdrop-blur-md">
              <Icon name="self_improvement" size={14} />
              Rythme doux &amp; progressif
            </div>
          </div>
          <ol className="relative z-10 flex flex-col gap-2.5">
            {ROUTINE.steps.map((step) => (
              <li key={step.title} className="flex items-center gap-space-sm rounded bg-surface-container-low/70 p-2.5">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-label-md text-label-md font-bold shadow-sm ${
                    step.exerciseId === 'respiration-lente' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-lowest text-primary'
                  }`}
                  aria-label={`${step.minutes} minute${step.minutes > 1 ? 's' : ''}`}
                >
                  {step.minutes}&apos;
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-label-lg text-label-lg text-on-surface">{step.title}</span>
                  <span className="text-[12px] leading-tight text-on-surface-variant">{step.subtitle}</span>
                </span>
                <Icon name={step.icon} size={18} className="text-secondary" />
              </li>
            ))}
          </ol>
          <div className="flex flex-col justify-between gap-space-sm pt-space-xs sm:flex-row sm:items-center">
            <span className="font-label-sm text-label-sm italic text-on-surface-variant">Chaque étape reste interruptible à tout moment</span>
            <Link
              to="/pratique/respiration-lente?routine=apaisement"
              className="flex h-12 items-center justify-center gap-space-xs rounded-full bg-primary px-space-lg font-label-lg text-label-lg text-on-primary shadow-md transition-all hover:bg-primary-container active:scale-[0.98]"
            >
              Lancer la routine
              <Icon name="arrow_forward" size={18} />
            </Link>
          </div>
        </section>

        <section className="flex flex-col gap-space-md" aria-labelledby="quick-title">
          <div className="flex items-end justify-between">
            <div>
              <h2 id="quick-title" className="font-headline-sm text-headline-sm text-on-surface">
                Pratiques ciblées
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Prêtes à être lancées selon votre besoin actuel</p>
            </div>
            <Link to="/exercices" className="flex min-h-[44px] items-center gap-0.5 font-label-md text-label-md font-semibold text-secondary hover:underline">
              Tout voir
              <Icon name="chevron_right" size={16} />
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-space-sm">
            {QUICK.map((item) => {
              const exercise = getExercise(item.id);
              return (
                <li key={item.id} className="flex items-center justify-between gap-space-sm rounded-lg bg-surface-container-lowest p-space-md shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex min-w-0 items-center gap-space-md">
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-sm ${item.tone}`}>
                      <Icon name={item.icon} size={24} />
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-space-xs font-label-sm text-label-sm">
                        <span className="font-semibold text-secondary">{item.label}</span>
                        <span className="text-on-surface-variant" aria-hidden="true">
                          •
                        </span>
                        <span className="text-on-surface-variant">{item.duration}</span>
                      </span>
                      <h3 className="truncate font-label-lg text-label-lg font-semibold text-on-surface">{exercise.title}</h3>
                      <p className="truncate text-[13px] text-on-surface-variant">{item.subtitle}</p>
                    </div>
                  </div>
                  <Link
                    to={`/pratique/${item.id}`}
                    aria-label={`Commencer : ${exercise.title}`}
                    className="flex min-h-[44px] shrink-0 items-center rounded-full bg-surface-container-low px-4 font-label-md text-label-md text-primary shadow-sm transition-colors hover:bg-secondary-container hover:text-on-secondary-container"
                  >
                    Commencer
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex flex-col gap-space-md rounded-lg bg-surface-container-lowest p-space-lg shadow-sm" aria-labelledby="week-title">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-secondary">Écoute de soi</span>
              <h2 id="week-title" className="font-headline-sm text-headline-sm text-on-surface">
                Votre semaine en douceur
              </h2>
            </div>
            <Link to="/suivi" aria-label="Voir mon suivi détaillé" className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container text-primary">
              <Icon name="show_chart" size={20} />
            </Link>
          </div>
          <dl className="grid grid-cols-2 gap-space-sm">
            <div className="flex flex-col gap-1 rounded bg-surface-container-low p-space-md">
              <dt className="font-label-sm text-label-sm text-on-surface-variant">Temps consacré</dt>
              <dd className="flex items-baseline gap-1">
                <span className="font-headline-lg text-headline-lg font-bold text-primary" data-testid="week-minutes">
                  {weekMinutes}
                </span>
                <span className="font-label-md text-label-md text-on-surface-variant">min cette semaine</span>
              </dd>
            </div>
            <div className="flex flex-col gap-1 rounded bg-surface-container-low p-space-md">
              <dt className="font-label-sm text-label-sm text-on-surface-variant">Séances vécues</dt>
              <dd className="flex items-baseline gap-1">
                <span className="font-headline-lg text-headline-lg font-bold text-primary" data-testid="week-sessions">
                  {stats.weekSessions}
                </span>
                <span className="font-label-md text-label-md text-on-surface-variant">{stats.weekSessions > 1 ? 'séances' : 'séance'}</span>
              </dd>
            </div>
          </dl>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
              <span>Objectif hebdomadaire</span>
              <span>
                {weekMinutes} / {preferences.weeklyGoalMinutes} min
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Progression de l'objectif hebdomadaire"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(stats.weeklyProgress * 100)}
              className="h-2 w-full overflow-hidden rounded-full bg-surface-container"
            >
              <div className="h-full rounded-full bg-secondary" style={{ width: `${stats.weeklyProgress * 100}%` }} />
            </div>
          </div>
          <div className="flex flex-col gap-space-xs pt-space-xs">
            <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
              <span>Minutes par jour (7 derniers jours)</span>
              <span>Moyenne ~ {averageMinutes} min / jour</span>
            </div>
            <WeeklyChart days={stats.last7Days} />
          </div>
          {favorite && stats.weekFavorite ? (
            <div className="flex items-center justify-between gap-space-sm rounded bg-surface-container-low p-space-sm">
              <div className="flex items-center gap-space-sm">
                <Icon name="favorite" size={22} className="text-secondary" />
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Pratique privilégiée cette semaine</span>
                  <span className="font-label-lg text-label-lg font-semibold text-on-surface">{favorite.title}</span>
                </div>
              </div>
              <span className="rounded-full bg-secondary-container/80 px-2.5 py-1 font-label-sm text-label-sm font-bold text-on-secondary-container">
                {Math.round(stats.weekFavorite.share * 100)} %
              </span>
            </div>
          ) : null}
          <p className="pt-1 font-body-sm text-body-sm italic leading-relaxed text-on-surface-variant">
            {hasWeek
              ? 'Chaque respiration posée compte. Continuez simplement à honorer ce temps quand votre journée le permet.'
              : 'Aucune séance enregistrée cette semaine. Vos chiffres apparaîtront ici à partir de vos pratiques réelles, sans pression ni série à maintenir.'}
          </p>
        </section>

        <SafetyNote>{SAFETY_NOTE}</SafetyNote>
      </div>
    </PageLayout>
  );
}
