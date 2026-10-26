import { useEffect, useId, useState } from 'react';
import { GROUNDING_STEPS } from '../../domain/exercises';
import { formatClock } from '../../domain/format';
import { nextStep, prevStep, sequenceProgress, skipUnit, type SequenceSession } from '../../engine/session';
import { Icon } from '../../ui/Icon';
import type { PracticeApi } from '../types';

const SHORT = ['Vue', 'Toucher', 'Ouïe', 'Odorat', 'Goût'];

/**
 * Optional observations stay in component memory only: they are never written to the session,
 * the history, local storage or exports, and are cleared when the step changes.
 */
function Observations({ suggestions }: { suggestions: string[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const inputId = useId();
  const toggle = (text: string) => setSelected((list) => (list.includes(text) ? list.filter((t) => t !== text) : [...list, text]));
  return (
    <section className="rounded-3xl border border-mineral bg-surface-container-lowest p-5 shadow-sm" aria-labelledby={`${inputId}-title`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Icon name="edit_note" size={20} className="text-secondary" />
        <h3 id={`${inputId}-title`} className="font-label-md text-label-md font-semibold text-primary">
          Noter vos observations
        </h3>
        <span className="font-label-sm text-label-sm text-on-surface-variant">(facultatif)</span>
      </div>
      <p className="mb-2 font-label-sm text-label-sm text-on-surface-variant">Suggestions à effleurer :</p>
      <div className="flex flex-wrap gap-2">
        {[...suggestions, ...custom].map((text) => {
          const on = selected.includes(text);
          return (
            <button
              key={text}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(text)}
              className={`flex min-h-[40px] items-center gap-1.5 rounded-full px-3 py-1.5 font-label-sm text-label-sm transition-all ${
                on ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface-variant hover:bg-secondary-container hover:text-on-secondary-container'
              }`}
            >
              <Icon name={on ? 'check' : 'add'} size={15} />
              {text}
            </button>
          );
        })}
      </div>
      <form
        className="mt-4 flex items-center gap-2 rounded-full bg-surface-container-low p-1 pl-4"
        onSubmit={(event) => {
          event.preventDefault();
          const text = draft.trim();
          if (!text) return;
          setCustom((list) => (list.includes(text) ? list : [...list, text]));
          setSelected((list) => (list.includes(text) ? list : [...list, text]));
          setDraft('');
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Ajouter une observation personnelle
        </label>
        <input
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ajouter une observation…"
          autoComplete="off"
          maxLength={120}
          className="h-11 min-w-0 flex-1 bg-transparent font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none"
        />
        <button type="submit" className="flex min-h-[44px] items-center gap-1 rounded-full bg-surface-container-lowest px-4 font-label-md text-label-md text-primary shadow-sm">
          <Icon name="check" size={16} />
          Retenir
        </button>
      </form>
      <p className="mt-3 flex items-start gap-2 font-label-sm text-label-sm text-on-surface-variant">
        <Icon name="lock" size={14} className="mt-0.5" />
        Vos remarques restent éphémères : elles ne sont ni enregistrées, ni exportées, et disparaissent à l'étape suivante.
      </p>
    </section>
  );
}

export function GroundingView({ api }: { api: PracticeApi }) {
  const session = api.session as SequenceSession;
  const p = sequenceProgress(session, api.now);
  const step = GROUNDING_STEPS[p.unit]!;
  const [announce, setAnnounce] = useState('');
  useEffect(() => setAnnounce(`Étape ${p.unit + 1} sur 5 : ${step.title}`), [p.unit, step.title]);

  return (
    <div className="flex w-full flex-col gap-4 rounded-3xl bg-surface-container-lowest/60 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1 font-label-md text-label-md text-on-secondary-container">
          <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
          {api.exercise.eyebrow}
        </span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-surface-container-low px-3 py-1.5 font-label-md text-label-md text-primary tabular-nums">
            <Icon name="schedule" size={16} className="text-secondary" />
            {formatClock(api.activeMs)}
            <span className="text-[11px] text-on-surface-variant">· Libre</span>
          </span>
          <button type="button" onClick={api.requestFinish} className="min-h-[44px] rounded-full bg-surface-container-low px-4 font-label-md text-label-md text-primary hover:bg-surface-container">
            Quitter en douceur
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between font-label-md text-label-md">
          <h2 className="font-semibold text-primary" data-testid="step-counter">
            Étape {p.unit + 1} sur 5
          </h2>
          <span className="text-on-surface-variant">Rythme libre et bienveillant</span>
        </div>
        <ol className="grid grid-cols-5 gap-2" aria-label="Progression 5-4-3-2-1">
          {GROUNDING_STEPS.map((s, i) => {
            const state = i === p.unit ? 'current' : session.outcomes[i];
            return (
              <li
                key={s.key}
                aria-current={i === p.unit ? 'step' : undefined}
                className={`flex flex-col items-center justify-center rounded-2xl px-1 py-2 ${
                  state === 'current'
                    ? 'bg-secondary-container text-on-secondary-container shadow-sm'
                    : state === 'done'
                      ? 'bg-surface-container text-on-surface'
                      : state === 'skipped'
                        ? 'bg-surface-container-low text-outline'
                        : 'bg-surface-container-low text-on-surface'
                }`}
              >
                <span className={`font-label-md text-label-md font-bold ${state === 'current' ? 'text-secondary' : ''}`}>{s.count}</span>
                <Icon name={s.icon ?? 'visibility'} size={14} />
                <span className="hidden text-[11px] xs:inline">{SHORT[i]}</span>
                <span className="sr-only">
                  {SHORT[i]} — {state === 'current' ? 'en cours' : state === 'done' ? 'faite' : state === 'skipped' ? 'passée' : 'à venir'}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-celadon to-surface-container p-6 text-center shadow-sm" data-testid="breath-visual" data-phase={step.key}>
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-secondary-container/40 blur-2xl" />
        <div className="relative mb-2 flex items-center justify-center gap-4">
          <span className="font-display text-display text-primary" data-testid="grounding-count">
            {step.count}
          </span>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
            <Icon name={step.icon ?? 'visibility'} size={30} />
          </span>
        </div>
        <span className="relative mb-3 inline-block rounded-full bg-surface-container-lowest/70 px-3 py-0.5 font-label-md text-label-md text-on-secondary-container">{step.sense}</span>
        <h3 className="relative mx-auto mb-3 max-w-md font-headline-md text-headline-md text-primary" data-testid="grounding-title">
          {step.title}
        </h3>
        <p className="relative mx-auto mb-2 max-w-lg font-body-md text-body-md leading-relaxed text-on-surface-variant">{step.instruction}</p>
        {api.paused ? (
          <p role="status" className="relative mt-2 font-label-md text-label-md text-secondary">
            Vous prenez votre temps — le chronomètre est en pause.
          </p>
        ) : null}
        <button type="button" onClick={() => api.act(skipUnit)} className="relative mt-2 min-h-[44px] font-label-md text-label-md text-on-surface-variant underline decoration-outline-variant underline-offset-4 hover:text-primary">
          Je préfère passer cette étape sans jugement
        </button>
      </section>

      <Observations key={step.key} suggestions={step.suggestions} />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => api.act(prevStep)}
          disabled={p.unit === 0}
          aria-label="Étape précédente"
          className="flex min-h-[52px] min-w-[56px] items-center justify-center gap-1 rounded-full bg-surface-container-high px-4 font-label-md text-label-md text-primary disabled:opacity-40"
        >
          <Icon name="arrow_back" size={18} />
          <span className="hidden xs:inline">Précédent</span>
        </button>
        <button type="button" onClick={api.togglePause} className="flex min-h-[52px] flex-1 items-center justify-center gap-1.5 rounded-full bg-surface-container-low px-3 font-label-md text-label-md text-primary">
          <Icon name={api.running ? 'pause' : 'play_arrow'} size={18} />
          {api.running ? 'Prendre mon temps' : 'Reprendre'}
        </button>
        <button type="button" onClick={() => api.act(nextStep)} className="flex min-h-[52px] flex-1 items-center justify-center gap-1.5 rounded-full bg-primary-container px-4 font-label-lg text-label-lg text-on-primary shadow-md hover:bg-secondary">
          {p.isLastStep ? 'Compléter la séance' : 'Suivant'}
          <Icon name="arrow_forward" size={18} />
        </button>
      </div>
    </div>
  );
}
