import { Link } from 'react-router-dom';
import alternateImage from '../assets/respiration-alternee.jpg';
import type { Exercise } from '../domain/exercises';
import { formatDuration, formatMinutesLabel } from '../domain/format';
import type { RoutineStep } from '../domain/routine';
import type { ExerciseConfig } from '../domain/types';
import { alternateCycleCount, buildSequencePlan, estimatePlanMs, pacedPhases } from '../engine/plan';
import type { Preferences } from '../storage/preferences';
import { ChoiceGroup } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { cadenceLabel } from './phaseText';
import { FootstepsArt } from './views/WalkingView';

interface ReadyProps {
  exercise: Exercise;
  config: ExerciseConfig;
  onConfigChange: (config: ExerciseConfig) => void;
  onStart: () => void;
  preferences: Preferences;
  routine: RoutineStep | null;
}

/** Duration, rhythm and volume summary for the ready state. */
export function configSummary(exercise: Exercise, config: ExerciseConfig): { duration: string; rhythm: string; rhythmLabel: string } {
  switch (exercise.protocol) {
    case 'paced':
      return { duration: formatMinutesLabel(config.durationSec), rhythmLabel: 'Rythme', rhythm: cadenceLabel(pacedPhases(exercise.id, config)) };
    case 'prompts':
      return { duration: formatMinutesLabel(config.durationSec), rhythmLabel: 'Souffle', rhythm: 'Libre' };
    default: {
      const plan = buildSequencePlan(exercise.id, config);
      const ms = estimatePlanMs(plan, config.excludedUnits);
      const units = plan.unitKeys.length - config.excludedUnits.length;
      const label =
        exercise.id === 'relaxation-musculaire'
          ? 'Zones'
          : exercise.id === 'scan-corporel'
            ? 'Zones'
            : exercise.id === 'ancrage-sensoriel'
              ? 'Étapes'
              : exercise.id === 'respiration-alternee'
                ? 'Cycles'
                : 'Répétitions';
      return {
        duration: ms > 0 ? (config.autoPace || exercise.id === 'relaxation-musculaire' || exercise.id === 'scan-corporel' ? `≈ ${formatDuration(Math.round(ms / 1000))}` : 'Libre') : 'Libre',
        rhythmLabel: label,
        rhythm: String(units),
      };
    }
  }
}

function RoutineBanner({ routine }: { routine: RoutineStep }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-secondary-container/40 p-4">
      <Icon name="chair" size={22} className="mt-0.5 text-secondary" />
      <div>
        <p className="font-label-lg text-label-lg text-primary">Routine « Parenthèse d’apaisement »</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Installez-vous paisiblement, posture détendue, yeux mi-clos. Étape guidée : {routine.title} ({routine.minutes} min).
        </p>
      </div>
    </div>
  );
}

function StartButton({ onStart, label }: { onStart: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onStart}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary-container font-label-lg text-label-lg font-semibold text-on-primary shadow-md transition-all hover:bg-primary active:scale-[0.98]"
    >
      <Icon name="play_arrow" size={22} filled />
      {label}
    </button>
  );
}

export function ReadyView({ exercise, config, onConfigChange, onStart, preferences, routine }: ReadyProps) {
  const summary = configSummary(exercise, config);
  const adjust = (
    <Link
      to={`/exercices/${exercise.id}`}
      className="flex min-h-[48px] w-full items-center justify-center rounded-full bg-surface-container py-3 font-label-lg text-label-lg font-semibold text-on-surface transition-all hover:bg-surface-container-high"
    >
      Ajuster les réglages
    </Link>
  );

  if (exercise.id === 'respiration-alternee') {
    return (
      <div className="flex w-full flex-col gap-5">
        {routine ? <RoutineBanner routine={routine} /> : null}
        <div className="flex flex-col gap-4 rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1 font-label-md text-label-md text-on-secondary-container">
              <Icon name="spa" size={16} />
              {exercise.eyebrow}
            </span>
            <span className="font-label-md text-label-md text-on-surface-variant">Nadi Shodhana</span>
          </div>
          <h2 className="font-headline-md text-headline-md text-primary">{exercise.title}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">{exercise.cue}</p>
          <div className="relative flex h-44 w-full items-center justify-center overflow-hidden rounded-xl bg-surface-container">
            <img className="h-full w-full object-cover object-[50%_30%]" src={alternateImage} alt="Illustration à l'aquarelle d'une personne assise pratiquant la respiration alternée, la main droite près du nez." width={286} height={512} />
            <div className="absolute inset-0 flex items-end bg-gradient-to-t from-primary/70 via-transparent to-transparent p-4">
              <span className="flex items-center gap-1.5 font-label-md text-label-md text-on-primary">
                <Icon name="verified" size={18} />
                Convient aux débutants et moments de tension
              </span>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
          <ChoiceGroup<number>
            label="Durée de la séance"
            value={config.durationSec}
            variant="tile"
            options={(exercise.options.durations ?? []).map((sec) => ({
              value: sec,
              label: formatMinutesLabel(sec),
              sublabel: `${alternateCycleCount({ ...config, durationSec: sec })} cycles`,
            }))}
            onChange={(v) => onConfigChange({ ...config, durationSec: v })}
          />
        </div>
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
          <h3 className="flex items-center gap-2 font-label-lg text-label-lg text-primary">
            <Icon name="self_improvement" size={20} className="text-secondary" />
            Posture recommandée (Nasika Mudra)
          </h3>
          <div className="flex items-start gap-3 rounded-xl bg-surface-container-low p-3.5">
            <Icon name="pan_tool_alt" size={22} className="mt-0.5 text-secondary" />
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Repliez doucement l'index et le majeur dans la paume de la main droite. Utilisez le <strong>pouce</strong> pour fermer la narine droite, et
              l’<strong>annulaire</strong> pour la narine gauche.
            </p>
          </div>
          <p className="flex items-center gap-2 px-1 font-label-sm text-label-sm text-on-surface-variant">
            <Icon name="check_circle" size={16} className="text-secondary" />
            Pression légère : un simple contact sans dévier la cloison nasale.
          </p>
        </div>
        <StartButton onStart={onStart} label="Commencer la pratique" />
        {adjust}
      </div>
    );
  }

  if (exercise.id === 'marche-attentive') {
    return (
      <div className="flex w-full flex-col gap-space-lg">
        {routine ? <RoutineBanner routine={routine} /> : null}
        <div className="relative flex flex-col items-center overflow-hidden rounded-[2rem] bg-gradient-to-br from-surface-container-lowest via-surface-container-lowest to-secondary-container/20 p-6 text-center shadow-sm">
          <div className="mb-space-md h-36 w-36">
            <FootstepsArt />
          </div>
          <span className="mb-space-sm inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1 font-label-md text-label-md text-on-secondary-container">
            <Icon name="directions_walk" size={16} />
            {exercise.eyebrow}
          </span>
          <h2 className="mb-space-xs font-headline-md text-headline-md text-primary">{exercise.title}</h2>
          <p className="max-w-sm font-body-md text-body-md text-on-surface-variant">{exercise.cue}</p>
        </div>
        <div className="rounded-[2rem] bg-surface-container-lowest p-6 shadow-sm">
          <div className="mb-space-md flex items-center justify-between">
            <span className="font-headline-sm text-headline-sm text-primary">Durée de la séance</span>
            <span className="font-label-md text-label-md font-semibold text-secondary">Respiration libre</span>
          </div>
          <ChoiceGroup<number>
            label="Durée de la séance"
            hideLabel
            value={config.durationSec}
            variant="tile"
            options={(exercise.options.durations ?? []).map((sec) => ({ value: sec, label: <span className="font-headline-sm text-headline-sm">{sec / 60}</span>, sublabel: 'minutes' }))}
            onChange={(v) => onConfigChange({ ...config, durationSec: v })}
          />
          <p className="pt-space-sm text-center font-body-sm text-body-sm text-on-surface-variant">Les invites contemplatives se renouvelleront doucement tout au long de votre parcours.</p>
        </div>
        <div className="flex items-start gap-4 rounded-[2rem] bg-surface-container-high p-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-on-secondary">
            <Icon name="visibility" size={22} />
          </span>
          <div>
            <h3 className="font-label-lg text-label-lg font-semibold text-primary">Consigne de sécurité</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{exercise.safety}</p>
          </div>
        </div>
        <StartButton onStart={onStart} label="Commencer la marche" />
      </div>
    );
  }

  if (exercise.id === 'ancrage-sensoriel') {
    return (
      <div className="flex w-full flex-col gap-5">
        <div className="flex flex-col items-center rounded-3xl bg-surface-container-lowest p-6 text-center shadow-sm">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
            <Icon name="self_improvement" size={32} />
          </span>
          <h2 className="mb-2 font-headline-md text-headline-md text-primary">Préparez-vous à revenir ici</h2>
          <p className="mb-4 font-body-md text-body-md leading-relaxed text-on-surface-variant">
            Installez-vous sans contrainte. Cet exercice ne cherche pas la perfection, mais une présence bienveillante à ce qui vous entoure maintenant.
          </p>
          <div className="flex items-start gap-3 rounded-2xl bg-surface-container-low p-4 text-left font-body-sm text-body-sm text-on-surface-variant">
            <Icon name="spa" size={22} className="mt-0.5 shrink-0 text-secondary" />
            <p>
              <strong className="mb-0.5 block font-semibold text-primary">Prenez le temps qu'il vous faut</strong>
              {exercise.cue}
            </p>
          </div>
        </div>
        <StartButton onStart={onStart} label="Commencer l'ancrage" />
      </div>
    );
  }

  const isSigh = exercise.id === 'soupir-physiologique';
  return (
    <div className="flex w-full flex-col">
      {routine ? (
        <div className="mb-space-md">
          <RoutineBanner routine={routine} />
        </div>
      ) : null}
      <div className="mb-space-sm">
        <h2 className="font-headline-md text-headline-md font-bold text-primary">{exercise.title}</h2>
        <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">{exercise.eyebrow}</p>
      </div>
      <div className="relative mx-auto my-space-md flex aspect-square w-full max-w-[300px] items-center justify-center">
        <div className="absolute inset-4 rounded-full bg-surface-container-high/30" />
        <div className="absolute inset-10 rounded-full bg-surface-container/60 shadow-inner" />
        <div
          className={`relative z-10 flex h-48 w-48 flex-col items-center justify-center rounded-full p-4 text-center shadow-md ${
            isSigh ? 'bg-gradient-to-br from-primary-container via-[#1f4a63] to-secondary text-on-primary' : 'bg-surface-container-lowest text-primary'
          }`}
        >
          {isSigh ? (
            <>
              <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-secondary-fixed">Prêt</span>
              <span className="font-headline-md text-headline-md font-bold leading-tight">Prenez votre temps</span>
              <span className="mt-1 text-[12px] text-on-primary/85">Sans forcer les poumons</span>
            </>
          ) : (
            <>
              <Icon name={exercise.icon} size={36} className="mb-1 text-secondary" />
              <span className="font-headline-sm text-headline-sm font-semibold text-primary">Prêt à commencer</span>
              <span className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{summary.duration === 'Libre' ? 'À votre rythme' : `${summary.duration} prévues`}</span>
            </>
          )}
        </div>
      </div>
      <dl className="mb-space-lg grid grid-cols-3 gap-2 rounded-lg bg-surface-container-lowest p-space-md text-center shadow-sm">
        <div className="flex flex-col items-center">
          <dt className="font-label-sm text-label-sm text-on-surface-variant">Durée</dt>
          <dd className="mt-0.5 font-label-lg text-label-lg font-semibold text-primary">{summary.duration}</dd>
        </div>
        <div className="flex flex-col items-center">
          <dt className="font-label-sm text-label-sm text-on-surface-variant">{summary.rhythmLabel}</dt>
          <dd className="mt-0.5 font-label-lg text-label-lg font-semibold text-secondary">{summary.rhythm}</dd>
        </div>
        <div className="flex flex-col items-center">
          <dt className="font-label-sm text-label-sm text-on-surface-variant">Sons</dt>
          <dd className="mt-0.5 font-label-lg text-label-lg font-semibold text-primary">
            {preferences.sound ? (preferences.soundTimbre === 'bol' ? 'Bol' : 'Carillon') : 'Coupés'}
          </dd>
        </div>
      </dl>
      <div className="flex w-full flex-col gap-space-sm">
        <StartButton onStart={onStart} label={isSigh ? `Commencer le soupir (${config.repetitions} cycle${config.repetitions > 1 ? 's' : ''})` : 'Commencer la séance'} />
        {adjust}
      </div>
    </div>
  );
}
