import { WALKING_PROMPTS } from '../../domain/exercises';
import { formatRemaining } from '../../domain/format';
import { nextPrompt, prevPrompt, promptIndexAt, type TimeboxedSession } from '../../engine/session';
import { Icon } from '../../ui/Icon';
import type { PracticeApi } from '../types';

export function FootstepsArt() {
  return (
    <svg className="h-full w-full text-secondary" fill="none" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="56" stroke="currentColor" strokeDasharray="4 6" strokeOpacity="0.3" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="44" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <circle cx="60" cy="60" r="34" stroke="currentColor" strokeOpacity="0.4" strokeWidth="2" />
      <path d="M50 40c-5 0-8 6-7 13 1 6 4 9 7 9s6-3 6-10c0-7-2-12-6-12z" fill="#146a5f" fillOpacity="0.75" />
      <circle cx="50" cy="69" r="3" fill="#146a5f" fillOpacity="0.75" />
      <path d="M70 52c-4 0-7 7-6 15 1 8 4 12 7 12s5-4 5-12c0-9-2-15-6-15z" fill="#183653" fillOpacity="0.75" />
      <circle cx="71" cy="85" r="3.5" fill="#183653" fillOpacity="0.75" />
    </svg>
  );
}

export function WalkingView({ api }: { api: PracticeApi }) {
  const session = api.session as TimeboxedSession;
  const active = Math.min(api.activeMs, session.targetMs);
  const index = promptIndexAt(session, active);
  const prompt = WALKING_PROMPTS[index]!;

  return (
    <div className="flex w-full flex-col gap-space-md">
      <div className="flex items-center justify-between rounded-full bg-surface-container-low px-4 py-2">
        <span className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface-variant">
          <Icon name="explore" size={18} className="text-secondary" />
          Regard ouvert sur le chemin
        </span>
        <span className="font-label-md text-label-md font-semibold text-primary" data-testid="prompt-counter">
          Invite {index + 1} sur {WALKING_PROMPTS.length}
        </span>
      </div>

      <section className="relative flex flex-col items-center overflow-hidden rounded-3xl bg-surface-container-lowest px-5 py-8 text-center shadow-sm" aria-labelledby="walk-title">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-40">
          <div className="h-96 w-96">
            <FootstepsArt />
          </div>
        </div>
        <h2 id="walk-title" className="relative font-label-sm text-label-sm font-semibold uppercase tracking-wider text-secondary">
          Temps de marche restant
        </h2>
        <p className="relative my-2 font-timer-display text-timer-display font-light text-primary tabular-nums" data-testid="remaining">
          {formatRemaining(session.targetMs - active)}
        </p>
        <p className="relative flex items-center gap-1.5 font-label-md text-label-md text-on-surface-variant" data-testid="breathing-mode">
          <span className={`inline-block h-2 w-2 rounded-full bg-secondary ${api.running ? 'animate-pulse' : ''}`} />
          Respiration libre &amp; naturelle — aucun rythme imposé
        </p>
        <div className="relative mt-6 w-full rounded-3xl bg-surface-container-low p-6" data-testid="breath-visual" data-phase={`prompt-${index}`}>
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
            <Icon name={prompt.icon ?? 'directions_walk'} size={24} />
          </span>
          <p className="font-headline-md text-headline-md leading-snug text-primary" data-testid="prompt-text" aria-live="polite">
            {prompt.title}
          </p>
        </div>
        <div className="relative mt-4 flex w-full gap-3">
          <button type="button" onClick={() => api.act(prevPrompt)} className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-full bg-surface-container font-label-lg text-label-lg text-primary hover:bg-surface-container-high">
            <Icon name="replay" size={20} />
            Précédente
          </button>
          <button type="button" onClick={() => api.act(nextPrompt)} className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-full bg-surface-container font-label-lg text-label-lg text-primary hover:bg-surface-container-high">
            Invite suivante
            <Icon name="arrow_forward" size={20} />
          </button>
        </div>
      </section>

      {api.paused ? (
        <div role="status" className="flex items-start gap-3 rounded-3xl bg-surface-container-high p-4">
          <Icon name="pause_circle" size={24} filled className="mt-0.5 text-secondary" />
          <div>
            <p className="font-label-lg text-label-lg font-semibold text-primary">Faites une pause, observez l'instant présent</p>
            <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">Respirez calmement avant de repartir.</p>
          </div>
        </div>
      ) : null}

      <div className="flex items-stretch gap-3">
        <button
          type="button"
          onClick={api.togglePause}
          className="flex min-h-[64px] flex-[2] items-center justify-center gap-2 rounded-full bg-primary-container font-headline-sm text-headline-sm text-on-primary shadow-md hover:bg-secondary active:scale-[0.98]"
        >
          <Icon name={api.running ? 'pause' : 'play_arrow'} size={28} filled />
          {api.running ? 'Pause' : 'Reprendre'}
        </button>
        <button type="button" onClick={api.requestFinish} className="flex min-h-[64px] flex-1 items-center justify-center gap-2 rounded-full bg-surface-container-lowest font-label-lg text-label-lg text-primary shadow-sm hover:bg-surface-container">
          <Icon name="stop_circle" size={24} className="text-error" />
          Terminer
        </button>
      </div>
      <p className="px-space-md pt-space-xs text-center font-body-sm text-body-sm text-on-surface-variant">
        Laissez votre regard libre. Vous n'avez pas besoin de fixer votre téléphone en marchant.
      </p>
    </div>
  );
}
