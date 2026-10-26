/** Stable identifiers — used in URLs, persisted history and exports. Never rename. */
export const EXERCISE_IDS = [
  'respiration-lente',
  'respiration-carree',
  'expiration-levres-pincees',
  'expiration-fredonnement',
  'respiration-alternee',
  'soupir-physiologique',
  'relaxation-musculaire',
  'scan-corporel',
  'marche-attentive',
  'ancrage-sensoriel',
] as const;

export type ExerciseId = (typeof EXERCISE_IDS)[number];

export function isExerciseId(value: unknown): value is ExerciseId {
  return typeof value === 'string' && (EXERCISE_IDS as readonly string[]).includes(value);
}

export type CategoryId = 'respiration' | 'relaxation' | 'ancrage' | 'mouvement';

/**
 * Protocol kinds:
 * - `paced`: continuous, time-boxed breathing cycle (inhale / hold / exhale / hold).
 * - `repetitions`: a counted number of repetitions, each made of short breath steps.
 * - `steps`: a guided sequence of steps / zones the user progresses through.
 * - `prompts`: time-boxed contemplative prompts with free, natural breathing (no cadence).
 */
export type ProtocolKind = 'paced' | 'repetitions' | 'steps' | 'prompts';

export type PhaseKey = 'inhale' | 'hold-in' | 'exhale' | 'hold-out';

export type PmrPreset = 'court' | 'standard' | 'long';

/**
 * A fully-resolved session configuration. Every exercise uses the same shape; fields that
 * do not apply to an exercise keep their normalised default and are ignored.
 */
export interface ExerciseConfig {
  durationSec: number;
  inhaleSec: number;
  exhaleSec: number;
  holdInEnabled: boolean;
  holdInSec: number;
  holdOutEnabled: boolean;
  holdOutSec: number;
  repetitions: number;
  autoPace: boolean;
  secondInhale: boolean;
  pmrPreset: PmrPreset;
  /** Unit keys (muscle groups) the user chose to skip. */
  excludedUnits: string[];
}

export type Feeling = 'leger' | 'calme' | 'tendu';

export type RecordStatus = 'completed' | 'partial';

/** A persisted practice record. Times are ISO-8601 strings (UTC). */
export interface SessionRecord {
  id: string;
  exerciseId: ExerciseId;
  status: RecordStatus;
  startedAt: string;
  endedAt: string;
  /** Active practice time in whole seconds (paused time excluded). */
  activeSeconds: number;
  /** Time spent paused, in whole seconds (informational only). */
  pausedSeconds: number;
  targetSeconds: number | null;
  unitsTotal: number | null;
  unitsCompleted: number | null;
  unitsSkipped: number | null;
  cyclesCompleted: number | null;
  feeling: Feeling | null;
}
