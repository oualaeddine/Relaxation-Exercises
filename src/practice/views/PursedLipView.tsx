import { formatClock, phaseSeconds } from '../../domain/format';
import { phaseAt, plannedCycles, type TimeboxedSession } from '../../engine/session';
import { Icon } from '../../ui/Icon';
import { phaseText } from '../phaseText';
import { PlayPauseButton, ProgressBar, SensoryToggles, ease } from '../shared';
import type { PracticeApi } from '../types';

export function PursedLipView({ api }: { api: PracticeApi }) {
  const session = api.session as TimeboxedSession;
  const active = Math.min(api.activeMs, session.targetMs);
  const info = phaseAt(session.segments, active);
  const text = phaseText(session.exerciseId, info.phase.key);
  const total = plannedCycles(session);
  const cycle = Math.min(total, info.cycleIndex + 1);
  const inhale = info.phase.key === 'inhale';
  const progress = ease(info.phaseElapsedMs / info.phase.durationMs);
  // The airflow ribbons drift in during the exhale and recede during the inhale (same timing source).
  const flow = api.reducedMotion ? 1 : inhale ? 0.92 - 0.04 * progress : 0.92 + 0.08 * progress;
  const [inhaleSec, exhaleSec] = [info.segment.phases[0]!.durationMs / 1000, info.segment.phases[1]!.durationMs / 1000];

  return (
    <div className="flex w-full flex-col space-y-5 pb-8">
      <div className="space-y-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-2.5 py-1 font-label-sm text-label-sm text-on-secondary-container">
          <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
          {api.exercise.eyebrow}
        </span>
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-headline-md text-headline-md tracking-tight text-primary">{api.exercise.title}</h2>
          <button
            type="button"
            onClick={api.openSettings}
            aria-label="Réglages de la séance"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary shadow-sm hover:bg-surface-container-high"
          >
            <Icon name="tune" size={20} />
          </button>
        </div>
        <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
          Cadence douce {inhaleSec}s inspiration nasale • {exhaleSec}s expiration lèvres pincées sans forcer
        </p>
      </div>

      <div className="relative flex flex-col items-center overflow-hidden rounded-lg bg-surface-container-lowest p-6 text-center shadow-sm" data-testid="breath-visual" data-phase={info.phase.key} data-scale={flow.toFixed(3)}>
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-secondary-container/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-44 w-44 rounded-full bg-surface-variant/50 blur-2xl" />
        {api.paused ? (
          <div className="relative z-10 flex flex-col items-center gap-2 py-6">
            <Icon name="spa" size={36} className="text-secondary" />
            <h3 className="font-headline-md text-headline-md text-primary">Respirez naturellement</h3>
            <p className="max-w-sm font-body-sm text-body-sm text-on-surface-variant">
              La séance est en pause. Relâchez vos lèvres et laissez votre souffle reprendre son rythme spontané.
            </p>
          </div>
        ) : (
          <>
            <div className="relative z-10 mb-3 inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1 font-label-md text-label-md uppercase tracking-wider text-on-secondary-container">
              <Icon name="air" size={14} />
              <span data-testid="phase-badge">{text.badge}</span>
            </div>
            <h3 className="relative z-10 mb-1 font-headline-lg text-headline-lg tracking-tight text-primary">{text.title}</h3>
            <div className="relative z-10 my-2 flex items-baseline justify-center gap-1" aria-hidden="true">
              <span className="font-timer-display-mobile text-timer-display-mobile font-light text-primary tabular-nums" data-testid="phase-count">
                {phaseSeconds(info.phaseRemainingMs)}
              </span>
              <span className="font-body-md text-body-md text-on-surface-variant">s</span>
            </div>
            <div className="relative my-1 flex h-28 w-full items-center justify-center overflow-hidden">
              <svg
                className="breath-transition h-full w-full"
                fill="none"
                viewBox="0 0 320 90"
                aria-hidden="true"
                style={{ transform: `scaleX(${flow}) ${inhale ? 'rotate(180deg)' : ''}` }}
              >
                <defs>
                  <linearGradient id="streamGrad1" x1="0%" x2="100%" y1="0%" y2="0%">
                    <stop offset="0%" stopColor="#146a5f" stopOpacity="0.1" />
                    <stop offset="50%" stopColor="#146a5f" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#a2eee0" stopOpacity="0.2" />
                  </linearGradient>
                  <linearGradient id="streamGrad2" x1="0%" x2="100%" y1="0%" y2="0%">
                    <stop offset="0%" stopColor="#183653" stopOpacity="0.05" />
                    <stop offset="40%" stopColor="#456080" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#146a5f" stopOpacity="0.15" />
                  </linearGradient>
                </defs>
                <circle cx="28" cy="45" fill="#183653" opacity="0.35" r="5" />
                <path d="M 28 35 C 32 40 32 50 28 55" opacity="0.4" stroke="#183653" strokeLinecap="round" strokeWidth="2" />
                <path d="M 38 45 C 90 28, 140 62, 200 42 C 245 28, 280 50, 310 45" stroke="url(#streamGrad1)" strokeLinecap="round" strokeWidth="3.5" />
                <path d="M 42 47 C 95 60, 155 30, 215 50 C 255 62, 285 40, 312 47" stroke="url(#streamGrad2)" strokeLinecap="round" strokeWidth="2.5" />
                <path d="M 46 43 C 110 38, 170 54, 230 44 C 270 38, 295 48, 315 45" opacity="0.9" stroke="#a2eee0" strokeDasharray="4 6" strokeLinecap="round" strokeWidth="1.8" />
              </svg>
              <span
                className={`absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full bg-surface-container-high/80 px-2.5 py-1 font-label-sm text-label-sm text-on-surface-variant backdrop-blur-sm transition-opacity ${
                  inhale ? 'opacity-30' : ''
                }`}
              >
                <Icon name="flare" size={16} className="text-secondary" />
                Effleurer l’air
              </span>
            </div>
            <p className="relative z-10 mt-1 max-w-sm font-body-sm text-body-sm text-on-surface-variant">{text.note}</p>
          </>
        )}
      </div>

      <div className="flex items-start gap-3 rounded bg-surface-container-low p-4 shadow-sm">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
          <Icon name="favorite" size={18} />
        </span>
        <div className="space-y-0.5">
          <h3 className="font-label-lg text-label-lg text-primary">Rappel bienveillant</h3>
          <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">{api.exercise.cue}</p>
        </div>
      </div>

      <div className="space-y-2.5 rounded bg-surface-container-lowest p-4 shadow-sm">
        <div className="flex items-center justify-between text-on-surface">
          <div className="flex items-center gap-2">
            <span className="font-headline-sm text-headline-sm font-semibold tracking-tight tabular-nums" data-testid="elapsed">
              {formatClock(active)}
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">/ {formatClock(session.targetMs)}</span>
          </div>
          <span className="rounded-full bg-surface-container px-2.5 py-1 font-label-md text-label-md font-medium text-on-primary-fixed-variant" data-testid="cycle">
            Cycle {cycle} sur {total}
          </span>
        </div>
        <ProgressBar value={active / session.targetMs} label="Progression de la séance" />
        <div className="pt-1">
          <SensoryToggles api={api} soundLabel="Sons apaisants" hapticLabel="Vibrations calmes" compact />
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 pt-2">
        <button type="button" onClick={api.requestRestart} className="flex flex-col items-center gap-1 text-on-surface-variant transition-all hover:text-primary active:scale-95">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container shadow-sm">
            <Icon name="replay" size={22} />
          </span>
          <span className="font-label-sm text-label-sm">Repartir</span>
        </button>
        <PlayPauseButton api={api} size={72} />
        <button type="button" onClick={api.requestFinish} className="flex flex-col items-center gap-1 text-on-surface-variant transition-all hover:text-primary active:scale-95">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container shadow-sm">
            <Icon name="check" size={22} />
          </span>
          <span className="font-label-sm text-label-sm">Terminer</span>
        </button>
      </div>

      <p className="px-1 pt-2 text-center font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
        <span className="font-semibold">Pratiquez à votre rythme :</span> {api.exercise.safety}
      </p>
    </div>
  );
}
