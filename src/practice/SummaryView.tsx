import { Link } from 'react-router-dom';
import type { SaveState } from '../app/SessionContext';
import type { Exercise } from '../domain/exercises';
import { formatDuration } from '../domain/format';
import type { RoutineStep } from '../domain/routine';
import type { ExerciseId, Feeling } from '../domain/types';
import { cyclesCompleted, type Session } from '../engine/session';
import { WRITE_ERROR_MESSAGES, type WriteError } from '../storage/store';
import { Icon } from '../ui/Icon';

const COPY: Record<ExerciseId, { title: string; message: string }> = {
  'respiration-lente': { title: 'Séance terminée en douceur', message: 'Prenez un instant pour observer comment vous vous sentez avant de reprendre vos activités.' },
  'respiration-carree': { title: 'Séance complétée', message: "Prenez un instant pour ressentir le calme intérieur et la clarté d'esprit." },
  'expiration-levres-pincees': { title: 'Votre souffle est apaisé', message: 'Observez la décompression au niveau de vos épaules et de votre cage thoracique.' },
  'expiration-fredonnement': { title: 'Séance accomplie', message: 'Laissez la vibration du fredonnement s’estomper doucement et observez vos sensations.' },
  'respiration-alternee': { title: 'Un équilibre retrouvé', message: 'Prenez quelques instants pour observer la clarté de vos pensées et la légèreté de votre souffle.' },
  'soupir-physiologique': { title: 'Rétablissement du calme', message: 'Observez vos sensations d’apaisement, puis revenez à votre respiration habituelle.' },
  'relaxation-musculaire': { title: 'Détente musculaire profonde', message: 'Remarquez la différence entre tension et détente dans les zones que vous avez parcourues.' },
  'scan-corporel': {
    title: 'Retour en douceur',
    message: 'Prenez quelques instants avant de vous relever. Bougez délicatement les doigts et les orteils, à votre rythme.',
  },
  'marche-attentive': { title: 'Merci pour cette pause', message: "Merci d'avoir pris ce moment d'ancrage avec vous-même et avec votre environnement." },
  'ancrage-sensoriel': {
    title: "Vous êtes ici, dans l'instant présent",
    message: 'Prenez quelques instants pour ressentir votre corps déposé et votre esprit allégé.',
  },
};

const UNIT_LABEL: Partial<Record<ExerciseId, string>> = {
  'expiration-fredonnement': 'Répétitions',
  'soupir-physiologique': 'Répétitions',
  'respiration-alternee': 'Cycles',
  'relaxation-musculaire': 'Zones relâchées',
  'scan-corporel': 'Zones explorées',
  'ancrage-sensoriel': 'Sens explorés',
};

const FEELINGS: { value: Feeling; label: string; icon: 'eco' | 'spa' | 'self_improvement' }[] = [
  { value: 'leger', label: 'Plus léger', icon: 'eco' },
  { value: 'calme', label: 'Posé & calme', icon: 'spa' },
  { value: 'tendu', label: 'Encore tendu', icon: 'self_improvement' },
];

interface SummaryProps {
  exercise: Exercise;
  session: Session;
  saveState: SaveState;
  saveError: WriteError | null;
  feeling: Feeling | null;
  onFeeling: (f: Feeling | null) => void;
  onRetry: () => void;
  onRestart: () => void;
  onLeave: (to: string) => void;
  nextRoutine: RoutineStep | null;
}

export function SummaryView({ exercise, session, saveState, saveError, feeling, onFeeling, onRetry, onRestart, onLeave, nextRoutine }: SummaryProps) {
  const partial = session.status === 'partial';
  const activeSeconds = Math.floor((session.finalActiveMs ?? 0) / 1000);
  const pausedSeconds = Math.floor(session.pausedMs / 1000);
  const copy = COPY[exercise.id];
  let second: { label: string; value: string };
  if (session.family === 'sequence') {
    const done = session.outcomes.filter((o) => o === 'done').length;
    const skipped = session.outcomes.filter((o) => o === 'skipped').length;
    second = { label: UNIT_LABEL[exercise.id] ?? 'Étapes', value: `${done} / ${session.unitKeys.length}${skipped ? ` (${skipped} passée${skipped > 1 ? 's' : ''})` : ''}` };
  } else if (session.prompts) {
    second = { label: 'Cadence', value: 'Naturelle' };
  } else {
    second = { label: 'Cycles complets', value: String(cyclesCompleted(session) ?? 0) };
  }

  return (
    <div className="flex w-full flex-col gap-space-lg">
      <section className="flex flex-col items-center rounded-xl bg-surface-container-lowest p-space-lg text-center shadow-md" aria-labelledby="summary-title">
        <span className="mb-space-sm flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container shadow-sm">
          <Icon name={partial ? 'spa' : 'check_circle'} size={36} filled />
        </span>
        <span className="font-label-sm text-label-sm font-semibold uppercase tracking-widest text-secondary" data-testid="summary-status">
          {partial ? 'Séance terminée plus tôt' : 'Séance accomplie'}
        </span>
        <h2 id="summary-title" className="mt-1 font-headline-md text-headline-md font-bold text-primary" tabIndex={-1}>
          {copy.title}
        </h2>
        <p className="mt-1 max-w-sm font-body-sm text-body-sm text-on-surface-variant">
          {partial ? 'Chaque minute de pratique compte. Vous pouvez reprendre une séance complète quand vous le souhaitez. ' : ''}
          {copy.message}
        </p>
        <dl className="mt-space-lg grid w-full grid-cols-2 gap-2 rounded-lg bg-surface-container-low p-space-md">
          <div className="flex flex-col">
            <dt className="font-label-sm text-label-sm text-on-surface-variant">Pratique active</dt>
            <dd className="mt-0.5 font-headline-sm text-headline-sm font-semibold text-primary" data-testid="summary-active">
              {formatDuration(activeSeconds)}
            </dd>
            {pausedSeconds > 0 ? <dd className="font-label-sm text-label-sm text-on-surface-variant">pauses exclues ({formatDuration(pausedSeconds)})</dd> : null}
          </div>
          <div className="flex flex-col">
            <dt className="font-label-sm text-label-sm text-on-surface-variant">{second.label}</dt>
            <dd className="mt-0.5 font-headline-sm text-headline-sm font-semibold text-secondary" data-testid="summary-units">
              {second.value}
            </dd>
          </div>
        </dl>
      </section>

      <div role="status" className="rounded-2xl" data-testid="save-state">
        {saveState === 'saved' ? (
          <p className="flex items-center gap-2 rounded-2xl bg-secondary-container/40 p-space-md font-body-sm text-body-sm text-on-surface">
            <Icon name="bookmark_add" size={20} className="text-secondary" />
            Séance enregistrée dans Mon suivi.
          </p>
        ) : saveState === 'not-recorded' ? (
          <p className="flex items-center gap-2 rounded-2xl bg-surface-container-low p-space-md font-body-sm text-body-sm text-on-surface-variant">
            <Icon name="info" size={20} />
            Séance trop courte (moins de 5 secondes de pratique) : elle n’a pas été enregistrée.
          </p>
        ) : saveState === 'disabled' ? (
          <p className="flex items-center gap-2 rounded-2xl bg-surface-container-low p-space-md font-body-sm text-body-sm text-on-surface-variant">
            <Icon name="privacy_tip" size={20} />
            L’enregistrement de l’historique est désactivé dans vos paramètres : cette séance n’a pas été conservée.
          </p>
        ) : saveState === 'error' ? (
          <div className="flex flex-col gap-2 rounded-2xl bg-error-container p-space-md text-on-error-container">
            <p className="flex items-start gap-2 font-body-sm text-body-sm">
              <Icon name="error" size={20} className="mt-0.5 shrink-0" />
              La séance n’a pas pu être enregistrée. {saveError ? WRITE_ERROR_MESSAGES[saveError] : ''}
            </p>
            <button type="button" onClick={onRetry} className="min-h-[44px] self-start rounded-full bg-surface-container-lowest px-4 font-label-lg text-label-lg text-primary">
              Réessayer l’enregistrement
            </button>
          </div>
        ) : null}
      </div>

      {saveState === 'saved' ? (
        <fieldset className="rounded-2xl bg-surface-container-low p-4">
          <legend className="sr-only">Ressenti</legend>
          <p className="mb-3 font-label-md text-label-md font-semibold text-primary" aria-hidden="true">
            Comment se sent votre corps en cet instant ? (facultatif)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {FEELINGS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={feeling === f.value}
                onClick={() => onFeeling(feeling === f.value ? null : f.value)}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-center font-label-sm text-label-sm shadow-sm transition-all ${
                  feeling === f.value ? 'bg-secondary-container font-semibold text-on-secondary-container' : 'bg-surface-container-lowest text-on-surface hover:bg-secondary-container/60'
                }`}
              >
                <Icon name={f.icon} size={20} />
                {f.label}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {nextRoutine ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface-container-high p-space-md">
          <p className="font-label-lg text-label-lg text-primary">Routine : étape suivante</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {nextRoutine.title} — {nextRoutine.subtitle}
          </p>
          <button
            type="button"
            onClick={() => onLeave(`/pratique/${nextRoutine.exerciseId}?routine=apaisement`)}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-primary-container font-label-lg text-label-lg text-on-primary hover:bg-secondary"
          >
            Continuer la routine
            <Icon name="arrow_forward" size={18} />
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-space-sm">
        <button
          type="button"
          onClick={() => onLeave('/suivi')}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary-container font-label-lg text-label-lg font-semibold text-on-primary shadow-md hover:bg-primary active:scale-[0.98]"
        >
          <Icon name="bar_chart" size={20} />
          Voir Mon suivi
        </button>
        <button type="button" onClick={onRestart} className="min-h-[48px] w-full rounded-full bg-surface-container py-3 font-label-lg text-label-lg font-semibold text-on-surface hover:bg-surface-container-high">
          Recommencer une séance
        </button>
        <Link to="/exercices" onClick={(event) => { event.preventDefault(); onLeave('/exercices'); }} className="flex min-h-[48px] w-full items-center justify-center rounded-full py-3 font-label-lg text-label-lg text-on-surface-variant hover:text-primary">
          Retour aux exercices
        </Link>
      </div>
    </div>
  );
}
