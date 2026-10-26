import { normalizeConfig } from './config';
import type { ExerciseConfig, ExerciseId } from './types';
import type { IconName } from '../ui/icons.generated';

export interface RoutineStep {
  minutes: number;
  title: string;
  subtitle: string;
  icon: IconName;
  /** Guided exercise for this step; text-only steps have none. */
  exerciseId?: ExerciseId;
  config?: ExerciseConfig;
}

export const ROUTINE_ID = 'apaisement';

/** "Parenthèse d'apaisement" — the home-page routine (≈ 10 min). */
export const ROUTINE: { id: string; title: string; steps: RoutineStep[] } = {
  id: ROUTINE_ID,
  title: 'Parenthèse d’apaisement',
  steps: [
    { minutes: 1, title: "S'installer paisiblement", subtitle: 'Posture détendue, yeux mi-clos', icon: 'chair' },
    {
      minutes: 5,
      title: 'Respiration lente',
      subtitle: 'Cohérence douce : 4s inspire / 6s expire',
      icon: 'waves',
      exerciseId: 'respiration-lente',
      config: normalizeConfig('respiration-lente', { durationSec: 300, inhaleSec: 4, exhaleSec: 6 }),
    },
    {
      minutes: 3,
      title: 'Relaxation musculaire progressive',
      subtitle: 'Relâchement des mains, des épaules et de la mâchoire',
      icon: 'spa',
      exerciseId: 'relaxation-musculaire',
      config: normalizeConfig('relaxation-musculaire', {
        pmrPreset: 'court',
        excludedUnits: ['abdomen', 'cuisses', 'pieds'],
      }),
    },
    { minutes: 1, title: 'Retour au calme', subtitle: 'Ancrage et reprise du souffle spontané', icon: 'favorite' },
  ],
};

/** Index (in ROUTINE.steps) of the guided step following `exerciseId`, if any. */
export function nextRoutineStep(exerciseId: ExerciseId): RoutineStep | null {
  const index = ROUTINE.steps.findIndex((s) => s.exerciseId === exerciseId);
  if (index === -1) return null;
  return ROUTINE.steps.slice(index + 1).find((s) => s.exerciseId) ?? null;
}

export function routineStepFor(exerciseId: ExerciseId): RoutineStep | null {
  return ROUTINE.steps.find((s) => s.exerciseId === exerciseId) ?? null;
}
