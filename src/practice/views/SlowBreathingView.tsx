import { formatRemaining, phaseSeconds } from '../../domain/format';
import { phaseAt, plannedCycles, type TimeboxedSession } from '../../engine/session';
import { Icon } from '../../ui/Icon';
import { cadenceLabel, phaseText } from '../phaseText';
import { ControlDock, ProgressBar, ReminderCard, SafetyFooter, SensoryToggles, SettingsButton, breathScale } from '../shared';
import type { PracticeApi } from '../types';

export function SlowBreathingView({ api }: { api: PracticeApi }) {
  const session = api.session as TimeboxedSession;
  const active = Math.min(api.activeMs, session.targetMs);
  const info = phaseAt(session.segments, active);
  const text = phaseText(session.exerciseId, info.phase.key);
  const total = plannedCycles(session);
  const cycle = Math.min(total, info.cycleIndex + 1);
  const remaining = session.targetMs - active;
  const progress = info.phaseElapsedMs / info.phase.durationMs;
  const scale = breathScale(info.phase.key, progress, api.reducedMotion);
  const cadence = cadenceLabel(info.segment.phases);

  return (
    <div className="flex w-full flex-col">
      <div className="mb-space-sm flex items-center justify-between gap-space-md">
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-space-xs">
            <h2 className="font-headline-md text-headline-md font-bold text-primary">{api.exercise.title}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-2.5 py-0.5 font-label-sm text-label-sm text-on-secondary-container">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
              {cadence}
            </span>
          </div>
          <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
            Rythme apaisant • {info.segment.phases[0]!.durationMs / 1000}s inspire / {info.segment.phases[1]!.durationMs / 1000}s expire
          </p>
        </div>
        <SettingsButton onClick={api.openSettings} label="Paramètres de respiration" />
      </div>
      <div className="mb-space-lg rounded-lg bg-surface-container-low px-space-md py-2.5 shadow-sm">
        <p className="flex items-start gap-2 font-body-sm text-body-sm text-on-surface">
          <Icon name="spa" size={18} filled className="mt-0.5 text-secondary" />
          <span>{api.exercise.cue}</span>
        </p>
      </div>

      {api.paused ? (
        <>
          <div className="mb-space-lg flex items-center justify-between rounded-lg bg-surface-container-high px-space-md py-space-sm text-on-surface">
            <span className="flex items-center gap-2 font-label-lg text-label-lg font-semibold text-primary">
              <Icon name="pause_circle" size={20} filled className="text-secondary" />
              Séance suspendue
            </span>
            <span className="font-label-md text-label-md text-on-surface-variant tabular-nums">{formatRemaining(remaining)} restant</span>
          </div>
          <div className="relative mx-auto my-space-sm flex aspect-square w-full max-w-[320px] items-center justify-center">
            <div className="absolute inset-8 rounded-full bg-surface-container-high/40" />
            <div className="relative z-10 flex h-52 w-52 flex-col items-center justify-center rounded-full bg-surface-container-lowest p-5 text-center text-on-surface shadow-lg">
              <Icon name="air" size={32} className="mb-1 text-secondary" />
              <p className="font-headline-sm text-headline-sm font-semibold leading-tight text-primary">Respirez naturellement</p>
              <p className="mt-2 px-2 text-center font-body-sm text-body-sm leading-snug text-on-surface-variant">
                La minuterie est figée. Reprenez votre rythme spontané sans pression.
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mb-space-lg flex items-center justify-between rounded-lg bg-surface-container-lowest px-space-md py-space-sm shadow-sm">
            <div className="flex items-center gap-2">
              <Icon name="timelapse" size={18} className="text-secondary" />
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Temps restant</span>
                <span className="font-headline-sm text-headline-sm font-semibold text-primary tabular-nums" data-testid="remaining">
                  {formatRemaining(remaining)}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Cycle</span>
                <span className="font-label-lg text-label-lg font-semibold text-primary tabular-nums" data-testid="cycle">
                  {cycle} / {total}
                </span>
              </div>
              <ProgressBar value={active / session.targetMs} label="Progression de la séance" className="mt-1 h-1.5 w-24" />
            </div>
          </div>
          <div
            className="relative mx-auto my-space-xs flex aspect-square w-full max-w-[320px] select-none items-center justify-center"
            data-testid="breath-visual"
            data-phase={info.phase.key}
            data-scale={scale.toFixed(3)}
          >
            <div className="breath-transition absolute inset-0 rounded-full bg-secondary-fixed-dim/20 blur-xl" style={{ transform: `scale(${scale * 1.05})` }} />
            <div className="breath-transition absolute inset-4 rounded-full bg-surface-container-high/60 shadow-sm" style={{ transform: `scale(${scale})` }} />
            <div className="breath-transition absolute inset-8 rounded-full bg-secondary-container/70" style={{ transform: `scale(${scale * 0.97})` }} />
            <div
              className="breath-transition relative z-10 flex h-48 w-48 flex-col items-center justify-center rounded-full bg-primary-container p-4 text-center text-on-primary shadow-xl"
              style={{ transform: `scale(${0.9 + (scale - 0.92) * 0.6})` }}
            >
              <span className="mb-1 rounded-full bg-secondary px-2.5 py-0.5 font-label-sm text-label-sm font-semibold uppercase tracking-widest text-on-secondary shadow-sm" data-testid="phase-badge">
                {text.badge}
              </span>
              <span className="px-1 font-headline-sm text-headline-sm font-semibold leading-tight text-on-primary">{text.title}</span>
              <span className="my-0.5 font-timer-display-mobile text-timer-display-mobile font-light text-secondary-fixed tabular-nums" aria-hidden="true" data-testid="phase-count">
                {phaseSeconds(info.phaseRemainingMs)}s
              </span>
              <span className="flex items-center gap-1 font-label-sm text-label-sm text-secondary-container">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-secondary-container" /> {text.note}
              </span>
            </div>
          </div>
        </>
      )}

      <div className="mb-space-lg mt-space-md">
        <SensoryToggles api={api} />
      </div>
      <div className="mb-space-lg">
        <ReminderCard title="Rappel corporel">Desserrez les épaules, relâchez les mâchoires et laissez le ventre s'assouplir sans effort.</ReminderCard>
      </div>
      <ControlDock api={api} />
      <SafetyFooter title="Conseil de confort">{api.exercise.safety}</SafetyFooter>
    </div>
  );
}
