import { PMR_GROUPS } from '../../domain/exercises';
import { formatRemaining } from '../../domain/format';
import { nextUnit, restartUnit, sequenceProgress, skipUnit, type SequenceSession } from '../../engine/session';
import { Icon } from '../../ui/Icon';
import { PausedBanner } from '../shared';
import type { PracticeApi } from '../types';

const ACTIVE = '#146a5f';
const IDLE = '#d1e4ff';

/** Calm, non-clinical silhouette; the active muscle group is highlighted. */
export function BodyMap({ group }: { group: string }) {
  const fill = (key: string) => (key === group ? ACTIVE : IDLE);
  return (
    <svg viewBox="0 0 160 220" className="h-full w-full select-none drop-shadow-sm" aria-hidden="true">
      <circle cx="80" cy="28" r="17" fill={fill('visage')} />
      <path d="M46 62 Q80 44 114 62 L108 74 Q80 62 52 74 Z" fill={fill('epaules')} />
      <rect x="58" y="70" width="44" height="60" rx="16" fill={fill('abdomen')} />
      <rect x="36" y="66" width="14" height="58" rx="7" fill={fill('bras')} transform="rotate(8 43 66)" />
      <rect x="110" y="66" width="14" height="58" rx="7" fill={fill('bras')} transform="rotate(-8 117 66)" />
      <circle cx="35" cy="130" r="8" fill={fill('mains')} />
      <circle cx="125" cy="130" r="8" fill={fill('mains')} />
      <rect x="60" y="128" width="18" height="46" rx="9" fill={fill('cuisses')} />
      <rect x="82" y="128" width="18" height="46" rx="9" fill={fill('cuisses')} />
      <rect x="62" y="174" width="14" height="30" rx="7" fill={fill('pieds')} opacity={group === 'pieds' ? 0.75 : 1} />
      <rect x="84" y="174" width="14" height="30" rx="7" fill={fill('pieds')} opacity={group === 'pieds' ? 0.75 : 1} />
      <ellipse cx="69" cy="208" rx="11" ry="6" fill={fill('pieds')} />
      <ellipse cx="91" cy="208" rx="11" ry="6" fill={fill('pieds')} />
    </svg>
  );
}

export function PmrView({ api }: { api: PracticeApi }) {
  const session = api.session as SequenceSession;
  const p = sequenceProgress(session, api.now);
  const group = PMR_GROUPS[p.unit]!;
  const included = session.excluded.filter((e) => !e).length;
  const groupNumber = session.excluded.slice(0, p.unit + 1).filter((e) => !e).length;
  const kind = p.step.key.startsWith('tension') ? 'tension' : p.step.key.startsWith('release') ? 'release' : 'integration';
  const round = Number(p.step.key.split('-')[1] ?? 1);
  const rounds = session.steps.filter((s) => s.unit === p.unit && s.key.startsWith('tension')).length;
  const duration = p.step.durationMs ?? 1;
  const remaining = p.stepRemainingMs ?? 0;
  // Remaining time of the whole plan (automatic steps only, excluded groups ignored).
  const remainingPlan =
    remaining +
    session.steps.slice(p.stepIndex + 1).reduce((sum, s) => sum + (session.excluded[s.unit] ? 0 : (s.durationMs ?? 0)), 0);
  const circumference = 2 * Math.PI * 50;
  const ratio = remaining / duration;

  const phase = {
    tension: {
      badge: 'Contraction douce',
      tagline: 'Serrez très légèrement, sans jamais forcer',
      quote: group.instruction,
      card: 'bg-primary text-on-primary',
      accent: 'text-secondary-fixed',
      ring: '#5fe0cb',
    },
    release: {
      badge: 'Relâchement complet',
      tagline: "Laissez retomber d'un coup • Soufflez",
      quote: 'Relâchez entièrement la zone. Expirez longuement et appréciez la sensation de chaleur et de décompression.',
      card: 'bg-secondary text-on-secondary',
      accent: 'text-secondary-container',
      ring: '#ffffff',
    },
    integration: {
      badge: 'Observez la détente',
      tagline: 'Respirez librement',
      quote: 'Remarquez la différence entre tension et détente. Rien à faire, simplement observer.',
      card: 'bg-surface-container-high text-on-surface',
      accent: 'text-secondary',
      ring: ACTIVE,
    },
  }[kind];

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-label-md text-label-md font-semibold uppercase tracking-wider text-secondary">
          <Icon name="self_improvement" size={18} />
          {api.paused ? 'Séance en pause' : 'Séance active'}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-surface-container-low px-3 py-1 font-label-md text-label-md font-semibold text-primary tabular-nums">
          <Icon name="schedule" size={16} className="text-secondary" />
          {formatRemaining(remainingPlan)} restant
        </span>
      </div>
      <div>
        <h2 className="font-headline-md text-headline-md text-primary">{api.exercise.title}</h2>
        <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">Méthode Jacobson adaptée • Tension douce 5s, relâchement 10s</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={api.openSettings} className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-surface-container-low px-4 font-label-md text-label-md text-primary hover:bg-surface-container">
          <Icon name="tune" size={16} />
          Zones ({included}/{PMR_GROUPS.length})
        </button>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-surface-container-lowest p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container font-label-lg text-label-lg font-bold text-on-secondary-container">{groupNumber}</span>
          <div>
            <span className="block font-label-sm text-label-sm font-semibold uppercase text-on-surface-variant" data-testid="group-counter">
              Groupe {groupNumber} sur {included}
            </span>
            <h3 className="font-headline-sm text-headline-sm leading-tight text-primary" data-testid="group-title">
              {group.title}
            </h3>
          </div>
        </div>
        <button type="button" onClick={() => api.act(skipUnit)} className="flex min-h-[44px] items-center gap-1 rounded-full bg-surface-container-low px-3 font-label-md text-label-md text-on-surface-variant hover:text-primary">
          <Icon name="skip_next" size={16} />
          Passer cette zone
        </button>
      </div>

      {api.paused ? <PausedBanner /> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="relative flex flex-col items-center rounded-3xl bg-surface-container-lowest p-5 shadow-sm md:col-span-5">
          <div className="mb-2 flex w-full items-center justify-between">
            <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">Schéma corporel doux</span>
            <span className="flex items-center gap-1 rounded-full bg-secondary-container px-2 py-0.5 font-label-sm text-label-sm text-on-secondary-container">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
              Zone active
            </span>
          </div>
          <div className="h-56 w-40" data-testid="body-map" data-group={group.key}>
            <BodyMap group={group.key} />
          </div>
          <p className="mt-2 flex w-full items-center justify-between font-label-sm text-label-sm">
            <span className="flex items-center gap-1 text-on-surface">
              <span className="h-2 w-2 rounded-full bg-secondary" /> {group.title}
            </span>
            <span className="text-secondary">Zone sensible ? Passez-la</span>
          </p>
        </div>

        <div
          className={`relative flex min-h-[340px] flex-col justify-between overflow-hidden rounded-3xl p-6 shadow-sm transition-colors duration-700 md:col-span-7 ${phase.card} ${kind !== 'integration' ? 'on-dark' : ''}`}
          data-testid="breath-visual"
          data-phase={kind}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 rounded-full bg-black/15 px-3 py-1.5 font-label-md text-label-md font-semibold uppercase tracking-wide">
              <span className="h-2 w-2 rounded-full bg-current" />
              <span data-testid="phase-badge">{phase.badge}</span>
            </span>
            {kind !== 'integration' ? (
              <span className="font-label-sm text-label-sm opacity-80">
                Cycle {round} sur {rounds}
              </span>
            ) : null}
          </div>
          <div className="my-4 flex flex-col items-center">
            <div className="relative h-32 w-32" aria-hidden="true">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="8" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke={phase.ring}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - ratio)}
                  className="breath-transition"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-timer-display-mobile text-timer-display-mobile font-light leading-none tabular-nums" data-testid="phase-count">
                  {String(Math.ceil(remaining / 1000)).padStart(2, '0')}
                </span>
                <span className="mt-1 font-label-sm text-label-sm opacity-80">sur {Math.round(duration / 1000)}s</span>
              </div>
            </div>
            <p className={`mt-3 text-center font-headline-sm text-headline-sm font-semibold tracking-tight ${phase.accent}`}>{phase.tagline}</p>
          </div>
          <p className="rounded-2xl bg-black/10 p-4 text-center font-body-sm text-body-sm leading-relaxed">« {phase.quote} »</p>
        </div>
      </div>

      <div className="rounded-3xl bg-surface-container-lowest p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Répéter ce groupe" onClick={() => api.act(restartUnit)} className="flex min-h-[52px] items-center justify-center gap-1 rounded-full bg-surface-container px-4 text-primary hover:bg-surface-container-high">
            <Icon name="replay" size={20} />
            <span className="hidden font-label-lg text-label-lg sm:inline">Répéter</span>
          </button>
          <button
            type="button"
            onClick={api.togglePause}
            className={`flex min-h-[52px] flex-[1.5] items-center justify-center gap-2 rounded-full px-6 py-3.5 font-label-lg text-label-lg shadow-md transition-all active:scale-95 ${
              api.running ? 'bg-primary text-on-primary hover:bg-primary-container' : 'bg-secondary text-on-secondary'
            }`}
          >
            <Icon name={api.running ? 'pause' : 'play_arrow'} size={24} filled />
            {api.running ? 'Pause' : 'Reprendre'}
          </button>
          <button type="button" onClick={() => api.act(nextUnit)} className="flex min-h-[52px] flex-1 items-center justify-center gap-1 rounded-full bg-secondary-container px-4 font-label-lg text-label-lg text-on-secondary-container hover:opacity-90">
            {p.isLastUnit ? 'Terminer' : 'Suivant'}
            <Icon name="arrow_forward" size={20} />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            aria-pressed={api.preferences.sound}
            onClick={() => api.setPreferences({ sound: !api.preferences.sound })}
            className="flex min-h-[44px] items-center gap-2 rounded-full px-2 font-label-sm text-label-sm text-on-surface-variant"
          >
            <Icon name="notifications_active" size={16} className={api.preferences.sound ? 'text-secondary' : 'text-outline'} />
            Carillon : {api.preferences.sound ? 'activé' : 'coupé'}
          </button>
          <button
            type="button"
            aria-pressed={api.preferences.voice}
            onClick={() => api.setPreferences({ voice: !api.preferences.voice })}
            className="flex min-h-[44px] items-center gap-2 rounded-full px-2 font-label-sm text-label-sm text-on-surface-variant"
          >
            <Icon name="record_voice_over" size={16} className={api.preferences.voice ? 'text-secondary' : 'text-outline'} />
            Voix : {api.preferences.voice ? 'activée' : 'coupée'}
          </button>
          <button type="button" onClick={api.requestFinish} className="flex min-h-[44px] items-center gap-1 rounded-full px-2 font-label-sm text-label-sm text-secondary">
            <Icon name="check_circle" size={16} />
            Terminer la séance
          </button>
        </div>
      </div>

      <aside className="flex items-start gap-3 rounded-3xl bg-surface-container-low p-4">
        <Icon name="verified_user" size={22} className="mt-0.5 shrink-0 text-secondary" />
        <div>
          <span className="font-label-md text-label-md font-semibold text-primary">Règle d'or de Jacobson</span>
          <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
            Ne forcez jamais au-delà de 20 à 30 % de votre force. Si une zone est endolorie, passez-la ou observez-la simplement sans contracter.
          </p>
        </div>
      </aside>
    </div>
  );
}
