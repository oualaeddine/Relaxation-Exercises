import { formatClock } from '../../domain/format';
import { nextStep, sequenceProgress, type SequenceSession } from '../../engine/session';
import { Icon } from '../../ui/Icon';
import { SettingsButton, ease } from '../shared';
import type { PracticeApi } from '../types';

const STEPS: Record<string, { label: string; title: string; sub: string; pill: string }> = {
  inhale1: { label: '1ʳᵉ inspiration', title: 'Inspirez doucement', sub: 'Par le nez, à un volume normal', pill: '1. Inspiration' },
  inhale2: { label: 'Appoint doux', title: 'Petite 2ᵉ inspiration', sub: 'Un court complément sans forcer', pill: '2. Micro-inspiration' },
  exhale: { label: 'Expiration lente', title: 'Expirez et relâchez', sub: 'Laissez l’air s’échapper longuement', pill: '3. Relâchement' },
};

export function SighView({ api }: { api: PracticeApi }) {
  const session = api.session as SequenceSession;
  const p = sequenceProgress(session, api.now);
  const step = STEPS[p.step.key] ?? STEPS.inhale1!;
  const unitSteps = session.steps.filter((s) => s.unit === p.unit).map((s) => s.key);
  const progress = p.step.durationMs ? Math.min(1, p.stepElapsedMs / p.step.durationMs) : 0;
  const repProgress = (p.stepInUnit + progress) / p.stepsInUnit;
  const inhaling = p.step.key !== 'exhale';
  const scale = api.reducedMotion ? 1 : inhaling ? 0.92 + 0.14 * ease((p.stepInUnit + progress) / Math.max(1, p.stepsInUnit - 1)) : 1.06 - 0.14 * ease(progress);
  const nextLabel = p.isLastStep ? "Terminer l'exercice" : p.stepInUnit === p.stepsInUnit - 1 ? 'Répétition suivante' : 'Étape suivante';

  return (
    <div className="flex w-full flex-col items-center gap-space-lg">
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-primary">{api.exercise.title}</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{api.exercise.eyebrow} • Rétablissement du calme</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-full bg-secondary-container/40 px-4 py-2 font-label-lg text-label-lg text-secondary" data-testid="repetition">
            <Icon name="sync_alt" size={16} />
            Répétition <strong className="text-primary">{p.unit + 1}</strong> sur {p.unitCount}
          </span>
          <SettingsButton onClick={api.openSettings} label="Paramètres de l'exercice" />
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-full border border-mineral bg-surface-container-lowest px-4 py-2 shadow-sm">
        <span className="font-label-sm text-label-sm text-on-surface-variant">Cycles :</span>
        <span className="flex items-center gap-1.5" aria-hidden="true">
          {session.outcomes.map((o, i) => (
            <span
              key={i}
              className={`rounded-full transition-all ${
                i === p.unit ? 'h-3 w-3 bg-secondary ring-2 ring-secondary-container' : o === 'done' ? 'h-2.5 w-2.5 bg-secondary' : o === 'skipped' ? 'h-2.5 w-2.5 bg-outline' : 'h-2.5 w-2.5 bg-surface-container-highest'
              }`}
            />
          ))}
        </span>
        <span className="text-label-sm text-outline" aria-hidden="true">
          •
        </span>
        <span className="font-label-sm text-label-sm font-medium text-primary tabular-nums">{formatClock(api.activeMs)}</span>
      </div>
      {api.paused ? (
        <p role="status" className="flex items-center gap-2 rounded-full bg-surface-container-high px-4 py-1.5 font-label-md text-label-md text-primary">
          <span className="h-2 w-2 rounded-full bg-[#a96518]" />
          En pause — respirez naturellement
        </p>
      ) : null}

      <div className="relative flex h-72 w-72 items-center justify-center" data-testid="breath-visual" data-phase={p.step.key} data-scale={scale.toFixed(3)}>
        <div className="absolute h-72 w-72 rounded-full bg-secondary-container/40 blur-3xl" />
        <div className="breath-transition absolute inset-0 rounded-full border border-secondary-fixed-dim/50 bg-celadon/30 shadow-md" style={{ transform: `scale(${scale})` }} />
        <div className="breath-transition absolute inset-6 rounded-full border border-primary-container/20 bg-surface-container-lowest/40" style={{ transform: `scale(${scale * 0.98})` }} />
        <div
          className="breath-transition relative flex h-56 w-56 flex-col items-center justify-center rounded-full bg-gradient-to-br from-primary-container via-[#1f4a63] to-secondary p-4 text-center text-on-primary shadow-xl"
          style={{ transform: `scale(${0.94 + (scale - 0.92) * 0.5})` }}
        >
          {p.step.key === 'inhale2' ? <span className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-secondary-fixed/30 blur-md" /> : null}
          <span className="mb-1 font-label-sm text-label-sm font-semibold uppercase tracking-wider text-secondary-fixed" data-testid="phase-badge">
            {api.paused ? 'En pause' : step.label}
          </span>
          <span className="px-2 font-headline-md text-headline-md font-bold leading-tight tracking-tight">{api.paused ? 'Prenez votre temps' : step.title}</span>
          <span className="mt-1 max-w-[170px] text-[12px] leading-snug text-on-primary/85">{api.paused ? 'Sans forcer les poumons' : step.sub}</span>
          <span className="mt-3 flex items-baseline gap-1 rounded-full bg-white/10 px-3 py-1" aria-hidden="true">
            <span className="font-label-lg text-label-lg font-bold tabular-nums" data-testid="phase-count">
              {p.stepRemainingMs === null || api.paused ? '--' : Math.ceil(p.stepRemainingMs / 1000)}
            </span>
            <span className="text-[12px] text-on-primary/80">sec</span>
          </span>
        </div>
      </div>

      <ol className="flex items-center gap-2 rounded-full border border-mineral bg-surface-container-lowest px-4 py-2 font-label-sm text-label-sm shadow-sm" aria-label="Étapes d'une répétition">
        {unitSteps.map((key, i) => (
          <li key={key} className={`flex items-center gap-2 ${i === p.stepInUnit ? 'font-bold text-secondary' : 'text-on-surface-variant'}`} aria-current={i === p.stepInUnit ? 'step' : undefined}>
            {i > 0 ? <span aria-hidden="true" className="text-outline-variant">•</span> : null}
            {STEPS[key]?.pill}
          </li>
        ))}
      </ol>

      <div className="w-full max-w-md space-y-1.5">
        <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
          <span>Progression de la répétition</span>
          <span className="tabular-nums">{Math.round(repProgress * 100)} %</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container" aria-hidden="true">
          <div className="breath-transition h-full rounded-full bg-gradient-to-r from-secondary-fixed-dim to-primary-container" style={{ width: `${repProgress * 100}%` }} />
        </div>
      </div>

      <div className="w-full max-w-xl rounded-3xl border border-mineral bg-surface-container-lowest p-4 shadow-sm sm:p-6">
        <p className="mb-4 flex items-start gap-2 rounded-2xl border border-mineral bg-surface-container-low/60 p-3 font-body-sm text-body-sm text-on-surface-variant">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-secondary" />
          <span>
            Le soupir physiologique aide à relâcher une montée de tension. Effectuez <strong className="text-primary">1 à 3 répétitions douces</strong>, sans hyperventilation.
          </span>
        </p>
        <div className="flex items-stretch gap-2">
          <button type="button" onClick={api.togglePause} className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-2xl border border-surface-container-high bg-surface-container-low px-3 font-label-lg text-label-lg text-primary hover:bg-surface-container">
            <Icon name={api.running ? 'pause' : 'play_arrow'} size={18} filled />
            {api.running ? 'Pause' : 'Reprendre'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (api.paused) api.resume();
              api.act(nextStep);
            }}
            className="flex min-h-[48px] flex-[1.5] items-center justify-center gap-2 rounded-2xl bg-secondary px-4 font-label-lg text-label-lg font-bold text-on-secondary shadow-sm hover:bg-on-secondary-container active:scale-[0.98]"
          >
            {nextLabel}
            <Icon name="chevron_right" size={18} />
          </button>
          <button type="button" aria-label="Terminer la séance" onClick={api.requestFinish} className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl bg-surface-container text-on-surface-variant hover:bg-error-container hover:text-on-error-container">
            <Icon name="close" size={20} />
          </button>
        </div>
        <p className="mt-3 text-center font-label-sm text-label-sm text-on-surface-variant">
          {session.config.autoPace ? 'Rythme automatique doux' : 'Rythme manuel : avancez avec « Étape suivante »'} •{' '}
          {session.config.secondInhale ? 'Double inspiration activée' : 'Inspiration simple'}
        </p>
      </div>
      <p className="max-w-2xl text-center text-[12px] leading-normal text-on-surface-variant">
        <strong className="font-semibold text-primary">Recommandation de confort :</strong> {api.exercise.safety}
      </p>
    </div>
  );
}
