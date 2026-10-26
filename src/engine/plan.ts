import { ALTERNATE_STEPS, BODY_SCAN_ZONES, GROUNDING_STEPS, PMR_GROUPS, getExercise } from '../domain/exercises';
import type { ExerciseConfig, ExerciseId, PhaseKey, PmrPreset } from '../domain/types';

export const MIN_PHASE_MS = 1_000;
export const MAX_PHASE_MS = 20_000;
export const MIN_TARGET_MS = 10_000;
export const MAX_TARGET_MS = 3 * 60 * 60 * 1000;

export interface PhaseSpec {
  key: PhaseKey;
  durationMs: number;
}

export interface PlanStep {
  /** Index of the unit (repetition, cycle, group, zone, step) this step belongs to. */
  unit: number;
  key: string;
  /** Automatic duration, or `null` when the user advances manually. */
  durationMs: number | null;
}

export interface SequencePlan {
  steps: PlanStep[];
  unitKeys: string[];
}

export const PMR_TENSION_MS = 5_000;
export const PMR_RELEASE_MS = 10_000;
export const PMR_PRESETS: Record<PmrPreset, { rounds: number; integrationMs: number; label: string }> = {
  court: { rounds: 2, integrationMs: 10_000, label: 'Court' },
  standard: { rounds: 3, integrationMs: 20_000, label: 'Standard' },
  long: { rounds: 4, integrationMs: 40_000, label: 'Long' },
};

export const HUM_INHALE_MS = 3_000;
export const HUM_EXHALE_MS = 8_000;
export const SIGH_STEPS_MS = { inhale1: 3_000, inhale2: 1_500, exhale: 6_000 } as const;
export const WALK_PROMPT_ROTATION_MS = 90_000;

/**
 * Validates phases: removes disabled (zero-length) phases and clamps durations to a safe range.
 * Returns `null` when nothing usable remains, so callers never build a zero-length cycle.
 */
export function normalizePhases(phases: readonly { key: PhaseKey; durationMs: unknown }[]): PhaseSpec[] | null {
  const result: PhaseSpec[] = [];
  for (const phase of phases) {
    const ms = typeof phase.durationMs === 'number' && Number.isFinite(phase.durationMs) ? phase.durationMs : 0;
    if (ms <= 0) continue;
    result.push({ key: phase.key, durationMs: Math.min(MAX_PHASE_MS, Math.max(MIN_PHASE_MS, Math.round(ms))) });
  }
  if (!result.some((p) => p.key === 'inhale') || !result.some((p) => p.key === 'exhale')) return null;
  return result;
}

export function cycleLengthMs(phases: readonly PhaseSpec[]): number {
  return phases.reduce((sum, p) => sum + p.durationMs, 0);
}

/** Breathing phases for paced exercises, derived from the configuration. */
export function pacedPhases(exerciseId: ExerciseId, config: ExerciseConfig): PhaseSpec[] {
  const raw: { key: PhaseKey; durationMs: number }[] = [{ key: 'inhale', durationMs: config.inhaleSec * 1000 }];
  if (exerciseId === 'respiration-carree' && config.holdInEnabled) {
    raw.push({ key: 'hold-in', durationMs: config.holdInSec * 1000 });
  }
  raw.push({ key: 'exhale', durationMs: config.exhaleSec * 1000 });
  if (exerciseId === 'respiration-carree' && config.holdOutEnabled) {
    raw.push({ key: 'hold-out', durationMs: config.holdOutSec * 1000 });
  }
  const phases = normalizePhases(raw);
  if (!phases) throw new Error('Cadence invalide');
  return phases;
}

export function normalizeTargetMs(ms: unknown): number {
  const n = typeof ms === 'number' && Number.isFinite(ms) ? ms : 0;
  if (n <= 0) return 5 * 60 * 1000;
  return Math.min(MAX_TARGET_MS, Math.max(MIN_TARGET_MS, Math.round(n)));
}

export function alternateCycleCount(config: ExerciseConfig): number {
  const cycleSec = 2 * (config.inhaleSec + config.exhaleSec);
  return Math.max(1, Math.round(config.durationSec / cycleSec));
}

export function buildSequencePlan(exerciseId: ExerciseId, config: ExerciseConfig): SequencePlan {
  const steps: PlanStep[] = [];
  const unitKeys: string[] = [];
  const auto = (ms: number): number | null => (config.autoPace ? ms : null);

  switch (exerciseId) {
    case 'expiration-fredonnement': {
      for (let u = 0; u < config.repetitions; u += 1) {
        unitKeys.push(`repetition-${u + 1}`);
        if (config.autoPace) {
          steps.push({ unit: u, key: 'inhale', durationMs: HUM_INHALE_MS });
          steps.push({ unit: u, key: 'hum', durationMs: HUM_EXHALE_MS });
        } else {
          steps.push({ unit: u, key: 'hum-free', durationMs: null });
        }
      }
      break;
    }
    case 'soupir-physiologique': {
      for (let u = 0; u < config.repetitions; u += 1) {
        unitKeys.push(`repetition-${u + 1}`);
        steps.push({ unit: u, key: 'inhale1', durationMs: auto(SIGH_STEPS_MS.inhale1) });
        if (config.secondInhale) steps.push({ unit: u, key: 'inhale2', durationMs: auto(SIGH_STEPS_MS.inhale2) });
        steps.push({ unit: u, key: 'exhale', durationMs: auto(SIGH_STEPS_MS.exhale) });
      }
      break;
    }
    case 'respiration-alternee': {
      const cycles = alternateCycleCount(config);
      for (let u = 0; u < cycles; u += 1) {
        unitKeys.push(`cycle-${u + 1}`);
        for (const step of ALTERNATE_STEPS) {
          const ms = (step.action === 'inhale' ? config.inhaleSec : config.exhaleSec) * 1000;
          steps.push({ unit: u, key: step.key, durationMs: auto(ms) });
        }
      }
      break;
    }
    case 'relaxation-musculaire': {
      const preset = PMR_PRESETS[config.pmrPreset];
      PMR_GROUPS.forEach((group, u) => {
        unitKeys.push(group.key);
        for (let r = 0; r < preset.rounds; r += 1) {
          steps.push({ unit: u, key: `tension-${r + 1}`, durationMs: PMR_TENSION_MS });
          steps.push({ unit: u, key: `release-${r + 1}`, durationMs: PMR_RELEASE_MS });
        }
        steps.push({ unit: u, key: 'integration', durationMs: preset.integrationMs });
      });
      break;
    }
    case 'scan-corporel': {
      const perZone = Math.round((config.durationSec * 1000) / BODY_SCAN_ZONES.length);
      BODY_SCAN_ZONES.forEach((zone, u) => {
        unitKeys.push(zone.key);
        steps.push({ unit: u, key: 'zone', durationMs: Math.max(MIN_PHASE_MS, perZone) });
      });
      break;
    }
    case 'ancrage-sensoriel': {
      GROUNDING_STEPS.forEach((step, u) => {
        unitKeys.push(step.key);
        steps.push({ unit: u, key: 'observe', durationMs: null });
      });
      break;
    }
    default:
      throw new Error(`${getExercise(exerciseId).title} n'est pas un exercice séquentiel`);
  }
  return { steps, unitKeys };
}

/** Estimated automatic duration of a plan in ms, ignoring excluded units and manual steps. */
export function estimatePlanMs(plan: SequencePlan, excludedKeys: readonly string[] = []): number {
  const excluded = new Set(excludedKeys);
  return plan.steps.reduce((sum, step) => {
    if (excluded.has(plan.unitKeys[step.unit] ?? '')) return sum;
    return sum + (step.durationMs ?? 0);
  }, 0);
}
