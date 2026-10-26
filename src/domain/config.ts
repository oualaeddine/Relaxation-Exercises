import { getExercise, type ConfigOptions, type Exercise, type NumberRange } from './exercises';
import type { ExerciseConfig, ExerciseId, PmrPreset } from './types';

const PMR_PRESETS: readonly PmrPreset[] = ['court', 'standard', 'long'];

function isRange(value: readonly number[] | NumberRange | undefined): value is NumberRange {
  return !!value && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Returns `value` if it is an allowed option, the clamped value for a range, otherwise the fallback. */
function pick(
  value: unknown,
  allowed: readonly number[] | NumberRange | undefined,
  fallback: number,
): number {
  const n = finiteNumber(value);
  if (n === null) return fallback;
  if (!allowed) return fallback;
  if (isRange(allowed)) return Math.min(allowed.max, Math.max(allowed.min, Math.round(n)));
  return allowed.includes(n) ? n : fallback;
}

function pickDuration(value: unknown, options: ConfigOptions, fallback: number): number {
  const n = finiteNumber(value);
  if (n === null || n <= 0) return fallback;
  if (options.durations?.includes(n)) return n;
  if (options.customDuration) {
    const { min, max } = options.customDuration;
    // Custom durations are whole minutes.
    const rounded = Math.round(n / 60) * 60;
    return Math.min(max, Math.max(min, rounded));
  }
  return fallback;
}

/**
 * Normalises an untrusted (possibly persisted or user-entered) configuration for an exercise.
 * Invalid, missing or out-of-range values fall back to the exercise defaults, so the result is
 * always safe to feed into the session engine (no zero or negative durations).
 */
export function normalizeConfig(exerciseOrId: Exercise | ExerciseId, input?: unknown): ExerciseConfig {
  const exercise = typeof exerciseOrId === 'string' ? getExercise(exerciseOrId) : exerciseOrId;
  const d = exercise.defaults;
  const o = exercise.options;
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;

  const excludable = new Set((exercise.units ?? []).map((u) => u.key));
  let excludedUnits: string[] = [];
  if (o.excludableUnits && Array.isArray(raw.excludedUnits)) {
    excludedUnits = [...new Set(raw.excludedUnits.filter((k): k is string => typeof k === 'string' && excludable.has(k)))];
    // At least one unit must remain.
    if (excludedUnits.length >= excludable.size) excludedUnits = [];
  }

  return {
    durationSec: o.durations || o.customDuration ? pickDuration(raw.durationSec, o, d.durationSec) : d.durationSec,
    inhaleSec: pick(raw.inhaleSec, o.inhale, d.inhaleSec),
    exhaleSec: pick(raw.exhaleSec, o.exhale, d.exhaleSec),
    holdInEnabled: o.hold && typeof raw.holdInEnabled === 'boolean' ? raw.holdInEnabled : d.holdInEnabled,
    holdInSec: pick(raw.holdInSec, o.hold, d.holdInSec),
    holdOutEnabled: o.hold && typeof raw.holdOutEnabled === 'boolean' ? raw.holdOutEnabled : d.holdOutEnabled,
    holdOutSec: pick(raw.holdOutSec, o.hold, d.holdOutSec),
    repetitions: pick(raw.repetitions, o.repetitions, d.repetitions),
    autoPace: o.autoPace && typeof raw.autoPace === 'boolean' ? raw.autoPace : d.autoPace,
    secondInhale: o.secondInhale && typeof raw.secondInhale === 'boolean' ? raw.secondInhale : d.secondInhale,
    pmrPreset:
      o.pmrPresets && PMR_PRESETS.includes(raw.pmrPreset as PmrPreset) ? (raw.pmrPreset as PmrPreset) : d.pmrPreset,
    excludedUnits,
  };
}

export function sameConfig(a: ExerciseConfig, b: ExerciseConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function rangeOf(allowed: readonly number[] | NumberRange | undefined): NumberRange | null {
  if (!allowed) return null;
  if (isRange(allowed)) return allowed;
  return { min: Math.min(...allowed), max: Math.max(...allowed) };
}

export function optionList(allowed: readonly number[] | NumberRange | undefined): number[] {
  if (!allowed) return [];
  if (isRange(allowed)) {
    const list: number[] = [];
    for (let v = allowed.min; v <= allowed.max; v += 1) list.push(v);
    return list;
  }
  return [...allowed];
}
