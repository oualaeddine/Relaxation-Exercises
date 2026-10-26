import { formatClock } from '../../domain/format';
import { nextUnit, sequenceProgress, skipUnit, type SequenceSession } from '../../engine/session';
import { normalizeConfig } from '../../domain/config';
import { Stepper, Switch } from '../../ui/controls';
import { Icon } from '../../ui/Icon';
import { ProgressBar, ease } from '../shared';
import type { PracticeApi } from '../types';

const TEXT = {
  inhale: { badge: 'Inspiration douce', title: 'Inspirez par le nez', desc: "Laissez l'air frais entrer sans tension dans les épaules." },
  hum: { badge: 'Expiration sonore', title: 'Fredonnez en expirant', desc: 'Son « mmmm » continu, lèvres closes, vibration douce dans la gorge.' },
  'hum-free': {
    badge: 'À votre rythme',
    title: 'Inspirez, puis fredonnez',
    desc: 'Inspirez par le nez, puis expirez sur un « mmmm » continu. Validez quand la répétition est terminée.',
  },
} as const;

export function HummingView({ api }: { api: PracticeApi }) {
  const session = api.session as SequenceSession;
  const p = sequenceProgress(session, api.now);
  const key = (p.step.key in TEXT ? p.step.key : 'hum-free') as keyof typeof TEXT;
  const text = TEXT[key];
  const remaining = p.stepRemainingMs;
  const progress = p.step.durationMs ? p.stepElapsedMs / p.step.durationMs : 0;
  const ripple = api.reducedMotion ? 1 : key === 'inhale' ? 0.88 + 0.12 * (1 - ease(progress)) : key === 'hum' ? 0.95 + 0.12 * ease(progress) : 1;
  const config = session.config;
  const repetitionsDone = p.unitsDone + p.unitsSkipped;

  return (
    <div className="flex w-full flex-col pb-10">
      <header className="mb-space-lg flex flex-col gap-space-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-headline-md text-headline-md tracking-tight text-primary">{api.exercise.title}</h2>
            <p className="mt-1 font-body-sm text-body-sm leading-relaxed text-on-surface-variant">{api.exercise.cue}</p>
          </div>
          <div className="flex items-center gap-space-xs">
            <button
              type="button"
              aria-pressed={api.preferences.sound}
              aria-label="Guidance sonore"
              onClick={() => api.setPreferences({ sound: !api.preferences.sound })}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container text-primary shadow-sm hover:bg-surface-variant"
            >
              <Icon name={api.preferences.sound ? 'volume_up' : 'volume_off'} size={20} filled={api.preferences.sound} />
            </button>
            <a href="#parametres-seance" aria-label="Paramètres de l'exercice" className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container text-primary shadow-sm hover:bg-surface-variant">
              <Icon name="tune" size={20} />
            </a>
          </div>
        </div>
      </header>

      {api.paused ? (
        <section className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl bg-surface-container-lowest p-8 text-center shadow-sm">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-secondary">
            <Icon name="spa" size={32} />
          </span>
          <h3 className="mb-2 font-headline-md text-headline-md text-primary">Respirez naturellement</h3>
          <p className="mb-6 max-w-sm font-body-md text-body-md leading-relaxed text-on-surface-variant">
            Prenez tout votre temps. Relâchez vos épaules et laissez l’air entrer et sortir sans aucun effort avant de reprendre.
          </p>
          <div className="mb-6 w-full max-w-xs rounded-2xl bg-surface-container-low p-4 text-left">
            <div className="flex items-center justify-between font-label-md text-label-md text-on-surface-variant">
              <span>Progression actuelle</span>
              <span className="font-semibold text-primary">
                {repetitionsDone} / {p.unitCount} répétitions
              </span>
            </div>
            <ProgressBar value={repetitionsDone / p.unitCount} label="Répétitions réalisées" className="mt-2 h-1.5" track="bg-surface-container-highest" />
          </div>
          <div className="flex w-full max-w-xs flex-col gap-3">
            <button type="button" onClick={api.resume} className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary-container font-label-lg text-label-lg text-on-primary hover:bg-secondary active:scale-[0.98]">
              <Icon name="play_arrow" size={22} filled />
              Reprendre la pratique
            </button>
            <button type="button" onClick={api.requestFinish} className="flex h-11 w-full items-center justify-center rounded-full font-label-md text-label-md text-on-surface-variant hover:text-primary">
              Terminer la séance maintenant
            </button>
          </div>
        </section>
      ) : (
        <div className="flex flex-col gap-space-lg">
          <section className="relative flex min-h-[360px] flex-col items-center justify-center overflow-hidden rounded-3xl bg-surface-container-lowest p-6 shadow-sm sm:p-8" data-testid="breath-visual" data-phase={p.step.key} data-scale={ripple.toFixed(3)}>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
              <div className="breath-transition absolute h-72 w-72 rounded-full bg-secondary-container/30" style={{ transform: `scale(${ripple})` }} />
              <div className="breath-transition absolute h-56 w-56 rounded-full bg-surface-variant/40" style={{ transform: `scale(${ripple * 1.02})` }} />
              <div className="breath-transition absolute h-44 w-44 rounded-full bg-secondary-fixed/50" style={{ transform: `scale(${ripple * 1.05})` }} />
            </div>
            <div className="relative z-10 flex max-w-xs flex-col items-center text-center">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1 font-label-md text-label-md font-semibold text-on-secondary-container">
                <span className="h-2 w-2 rounded-full bg-secondary" />
                <span data-testid="phase-badge">{text.badge}</span>
              </div>
              <div className="my-2" aria-hidden="true">
                <span className="font-timer-display-mobile text-timer-display-mobile font-light tracking-tight text-primary tabular-nums" data-testid="phase-count">
                  {remaining === null ? formatClock(p.stepElapsedMs) : `0:${String(Math.ceil(remaining / 1000)).padStart(2, '0')}`}
                </span>
              </div>
              <h3 className="mb-1 font-headline-sm text-headline-sm text-primary">{text.title}</h3>
              <p className="max-w-[260px] font-body-sm text-body-sm leading-relaxed text-on-surface-variant">{text.desc}</p>
              <div className="mt-6 flex flex-col items-center gap-2">
                <span className="font-label-md text-label-md font-medium text-on-surface-variant" data-testid="repetition">
                  Répétition <span className="font-bold text-primary">{p.unit + 1}</span> sur {p.unitCount}
                </span>
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  {session.outcomes.map((outcome, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        outcome === 'done' ? 'w-5 bg-secondary' : outcome === 'skipped' ? 'w-5 bg-outline-variant' : i === p.unit ? 'w-5 bg-secondary/60' : 'w-1.5 bg-surface-container-highest'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
          <section className="flex flex-col gap-space-sm" aria-label="Commandes de la séance">
            <button
              type="button"
              onClick={() => api.act(nextUnit)}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary-container font-body-lg text-body-lg font-medium text-on-primary shadow-sm transition-all hover:bg-secondary active:scale-[0.98]"
            >
              {p.isLastUnit ? 'Terminer la dernière répétition' : 'Répétition terminée'}
              <Icon name="arrow_forward" size={22} />
            </button>
            <div className="grid grid-cols-2 gap-space-sm">
              <button type="button" onClick={api.pause} className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-surface-container-low font-label-lg text-label-lg text-primary hover:bg-surface-container">
                <Icon name="pause" size={20} />
                Mettre en pause
              </button>
              <button type="button" onClick={() => api.act(skipUnit)} className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-surface-container-low font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container hover:text-primary">
                <Icon name="skip_next" size={20} />
                Passer ce cycle
              </button>
            </div>
            <button type="button" onClick={api.requestFinish} className="mx-auto flex min-h-[44px] items-center gap-1 px-3 font-label-md text-label-md text-on-surface-variant hover:text-primary">
              <Icon name="check_circle" size={16} />
              Terminer la séance maintenant
            </button>
          </section>
        </div>
      )}

      <section id="parametres-seance" className="mt-space-md flex flex-col gap-5 rounded-3xl bg-surface-container-lowest p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-headline-sm text-headline-sm text-primary">
            <Icon name="tune" size={22} className="text-secondary" />
            Paramètres de la séance
          </h3>
          <span className="rounded-full bg-surface-container px-2.5 py-1 font-label-sm text-label-sm text-on-surface-variant">Personnalisé</span>
        </div>
        <Stepper
          label="Nombre de répétitions"
          description="5 à 10 cycles recommandés"
          value={config.repetitions}
          min={Math.max(5, p.unit + 1)}
          max={10}
          onChange={(v) => api.applyConfig(normalizeConfig(api.exercise, { ...config, repetitions: v }))}
        />
        <Switch
          label="Défilement doux automatique"
          description="Rythme suggéré : 3s inspire / 8s fredonne. Changer de mode reprend la répétition en cours depuis son début."
          checked={config.autoPace}
          onChange={(v) => api.applyConfig(normalizeConfig(api.exercise, { ...config, autoPace: v }))}
        />
      </section>
      <aside className="mt-space-md flex items-start gap-3.5 rounded-2xl bg-surface-container-low p-5 text-on-surface-variant">
        <Icon name="info" size={22} className="mt-0.5 shrink-0 text-secondary" />
        <div className="flex flex-col gap-1">
          <span className="font-label-md text-label-md font-semibold text-primary">Conseil d'aisance</span>
          <p className="font-body-sm text-body-sm leading-relaxed">{api.exercise.safety}</p>
        </div>
      </aside>
    </div>
  );
}
