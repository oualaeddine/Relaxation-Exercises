import { useState } from 'react';
import { normalizeConfig } from '../../domain/config';
import { ALTERNATE_STEPS } from '../../domain/exercises';
import { formatClock } from '../../domain/format';
import { nextStep, prevStep, sequenceProgress, type SequenceSession } from '../../engine/session';
import { Icon } from '../../ui/Icon';
import type { PracticeApi } from '../types';

function Nostril({ side, active, action }: { side: 'gauche' | 'droite'; active: boolean; action: 'inhale' | 'exhale' }) {
  return (
    <div className={`flex flex-col items-center transition-all duration-500 ${active ? 'scale-105' : 'scale-95'}`} data-testid={`nostril-${side}`} data-state={active ? 'ouverte' : 'fermee'}>
      <span
        className={`mb-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase shadow-sm ${
          active ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-on-surface-variant'
        }`}
      >
        {active ? 'Ouverte' : 'Fermée'}
      </span>
      <div className={`flex h-14 w-12 flex-col items-center justify-center rounded-2xl shadow-sm ${active ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'}`}>
        <Icon name={active ? (action === 'inhale' ? 'arrow_upward' : 'arrow_downward') : 'front_hand'} size={22} />
        <span className="text-[10px] font-semibold uppercase">{side}</span>
      </div>
    </div>
  );
}

export function AlternateView({ api }: { api: PracticeApi }) {
  const session = api.session as SequenceSession;
  const p = sequenceProgress(session, api.now);
  const content = ALTERNATE_STEPS[p.stepInUnit] ?? ALTERNATE_STEPS[0]!;
  const [tipsOpen, setTipsOpen] = useState(false);
  const auto = session.config.autoPace;
  const stepSeconds = (content.action === 'inhale' ? session.config.inhaleSec : session.config.exhaleSec);
  const ringProgress = (p.stepInUnit + (p.step.durationMs ? Math.min(1, p.stepElapsedMs / p.step.durationMs) : 1)) / 4;
  const circumference = 276;

  if (api.paused) {
    return (
      <div className="flex w-full flex-col gap-5">
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-surface-container-lowest p-6 text-center shadow-sm">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-secondary">
            <Icon name="self_improvement" size={32} />
          </span>
          <div className="flex flex-col gap-1.5">
            <span className="self-center rounded-full bg-surface-container px-3 py-1 font-label-sm text-label-sm text-on-surface-variant">Séance suspendue</span>
            <h2 className="font-headline-md text-headline-md text-primary">Prenez votre temps</h2>
            <p className="max-w-sm font-body-md text-body-md text-on-surface-variant">
              Reposez la main sur votre cuisse. Laissez vos deux narines respirer librement et sans effort le temps de retrouver un rythme naturel.
            </p>
          </div>
          <div className="flex w-full items-center justify-around rounded-2xl bg-surface-container-low p-4">
            <div className="flex flex-col items-center">
              <span className="font-headline-sm text-headline-sm text-primary tabular-nums">{formatClock(api.activeMs)}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Temps actif</span>
            </div>
            <div className="h-8 w-px bg-outline-variant/40" />
            <div className="flex flex-col items-center">
              <span className="font-headline-sm text-headline-sm text-secondary">
                Cycle {p.unit + 1} / {p.unitCount}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Progression</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <button type="button" onClick={api.resume} className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary font-label-lg text-label-lg text-on-primary shadow-md hover:bg-secondary active:scale-[0.98]">
            <Icon name="play_arrow" size={22} filled />
            Reprendre la pratique
          </button>
          <button type="button" onClick={api.requestFinish} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-surface-container font-label-lg text-label-lg text-primary hover:bg-surface-container-high">
            <Icon name="flag" size={20} />
            Terminer la séance maintenant
          </button>
        </div>
        <SafetyLine api={api} />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between rounded-2xl bg-surface-container-lowest px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-secondary" />
          <h2 className="font-label-md text-label-md text-primary" data-testid="cycle">
            {api.exercise.title} · Cycle {p.unit + 1} sur {p.unitCount}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-label-md text-label-md text-on-surface-variant tabular-nums">{formatClock(api.activeMs)}</span>
          <button
            type="button"
            aria-pressed={auto}
            onClick={() => api.applyConfig(normalizeConfig(api.exercise, { ...session.config, autoPace: !auto }))}
            className="min-h-[44px] rounded-full bg-surface-container-low px-2.5 py-1 font-label-sm text-label-sm text-secondary hover:bg-surface-container"
          >
            {auto ? 'Mode guidé auto' : 'Mode manuel libre'}
          </button>
        </div>
      </div>

      <div className="relative flex flex-col items-center overflow-hidden rounded-3xl bg-surface-container-lowest p-6 shadow-sm" data-testid="breath-visual" data-phase={content.key}>
        <div className="pointer-events-none absolute -top-10 h-56 w-56 rounded-full bg-secondary-container/40 blur-3xl" />
        <div className="z-10 mb-2 flex w-full items-center justify-between">
          <span className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
            <Icon name="air" size={15} className="text-secondary" />
            Souffle continu sans apnée
          </span>
          <span className="font-label-sm text-label-sm font-semibold text-secondary" aria-hidden="true">
            {p.stepRemainingMs === null ? 'À votre rythme' : `${Math.ceil(p.stepRemainingMs / 1000)} secondes`}
          </span>
        </div>
        <div className="relative z-10 my-1 flex h-64 w-64 items-center justify-center">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
            <circle className="stroke-current text-surface-container" cx="50" cy="50" fill="transparent" r="44" strokeWidth="3" />
            <circle
              className="breath-transition stroke-current text-secondary"
              cx="50"
              cy="50"
              fill="transparent"
              r="44"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - circumference * ringProgress}
              strokeLinecap="round"
              strokeWidth="4.5"
            />
          </svg>
          <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-surface p-3 shadow-inner">
            <div className="relative flex h-36 w-36 items-start justify-between px-2 pt-6">
              <Nostril side="gauche" active={content.nostril === 'gauche'} action={content.action} />
              <div className="mt-4 h-16 w-0.5 rounded-full bg-surface-container-highest" />
              <Nostril side="droite" active={content.nostril === 'droite'} action={content.action} />
              <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-surface-container-lowest px-3 py-1 text-[11px] text-primary shadow-sm">
                <Icon name="touch_app" size={14} className="text-secondary" />
                {content.finger}
              </div>
            </div>
          </div>
        </div>
        <div className="z-10 mt-1 text-center">
          <span className="block font-headline-sm text-headline-sm text-primary" data-testid="phase-badge">
            {content.action === 'inhale' ? 'Inspiration' : 'Expiration'}
          </span>
          <span className="mt-0.5 block font-body-sm text-body-sm font-medium text-secondary">
            Par la narine {content.nostril} • {auto ? `${stepSeconds} secondes` : 'à votre rythme'}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-label-md text-label-md font-semibold text-secondary" data-testid="step-label">
            Étape {p.stepInUnit + 1} sur 4
          </span>
          <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
            <Icon name="sync_alt" size={15} />
            Alternance douce
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-headline-sm text-headline-sm leading-snug text-primary" data-testid="instruction">
            {content.title}
          </p>
          <p className="font-body-md text-body-md text-on-surface-variant">{content.instruction}</p>
        </div>
        <div className="mt-1 flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-2.5">
          <Icon name="fast_forward" size={18} className="text-secondary" />
          <span className="font-label-sm text-label-sm text-on-surface">{content.next}</span>
        </div>
        <div className="mt-1">
          <button
            type="button"
            aria-expanded={tipsOpen}
            aria-controls="astuces-doigts"
            onClick={() => setTipsOpen((v) => !v)}
            className="flex min-h-[44px] w-full items-center justify-between py-1 text-left font-label-md text-label-md text-secondary"
          >
            <span className="flex items-center gap-1.5">
              <Icon name="lightbulb" size={18} />
              Astuce confort pour vos doigts
            </span>
            <Icon name="keyboard_arrow_down" size={18} className={`transition-transform ${tipsOpen ? 'rotate-180' : ''}`} />
          </button>
          {tipsOpen ? (
            <div id="astuces-doigts" className="mt-2 flex flex-col gap-1.5 rounded-xl bg-surface p-3 font-body-sm text-body-sm text-on-surface-variant">
              <p>• Si votre épaule ou votre coude fatigue, soutenez délicatement le coude droit avec votre main gauche.</p>
              <p>• Ne forcez jamais en cas de légère congestion : gardez les deux narines entrouvertes.</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-3">
        <button type="button" aria-label="Étape précédente" onClick={() => api.act(prevStep)} className="flex h-[52px] min-w-[52px] items-center justify-center rounded-full bg-surface-container-lowest px-3.5 text-primary shadow-sm hover:bg-surface-container active:scale-95">
          <Icon name="chevron_left" size={24} />
        </button>
        <button type="button" onClick={api.togglePause} className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-primary font-label-lg text-label-lg text-on-primary shadow-md hover:bg-secondary active:scale-[0.98]">
          <Icon name="pause" size={22} filled />
          Mettre en pause
        </button>
        <button type="button" aria-label={p.isLastStep ? 'Terminer la dernière étape' : 'Étape suivante'} onClick={() => api.act(nextStep)} className="flex h-[52px] min-w-[52px] items-center justify-center rounded-full bg-surface-container-lowest px-3.5 text-primary shadow-sm hover:bg-surface-container active:scale-95">
          <Icon name="chevron_right" size={24} />
        </button>
      </div>
      <div className="flex justify-center gap-2">
        {auto ? (
          <button
            type="button"
            onClick={() => api.applyConfig(normalizeConfig(api.exercise, { ...session.config, autoPace: false }))}
            className="min-h-[44px] rounded-full px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:text-primary"
          >
            Avancer à mon propre rythme
          </button>
        ) : null}
        <button type="button" onClick={api.requestFinish} className="min-h-[44px] rounded-full px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:text-primary">
          Terminer la séance
        </button>
      </div>
      <SafetyLine api={api} />
    </div>
  );
}

function SafetyLine({ api }: { api: PracticeApi }) {
  return (
    <div className="mt-6 flex items-start gap-2.5 rounded-2xl bg-surface-container-low p-3.5 font-label-sm text-label-sm text-on-surface-variant">
      <Icon name="shield" size={18} className="mt-0.5 shrink-0 text-secondary" />
      <p>
        <strong>Recommandation bienveillante :</strong> {api.exercise.safety}
      </p>
    </div>
  );
}
