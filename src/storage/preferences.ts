import { normalizeConfig } from '../domain/config';
import { EXERCISE_IDS, type ExerciseConfig, type ExerciseId } from '../domain/types';
import { safeRead, safeRemove, safeWrite, type KeyValueStore, type WriteResult } from './store';

export const PREFERENCES_KEY = 'calme.preferences';
export const PREFERENCES_SCHEMA_VERSION = 1;

export type SoundTimbre = 'bol' | 'carillon';
export type MotionPreference = 'system' | 'reduce';

export interface Preferences {
  schemaVersion: 1;
  /** Soft chime at phase / step transitions. */
  sound: boolean;
  soundTimbre: SoundTimbre;
  /** 0–100. */
  volume: number;
  haptics: boolean;
  /** Spoken French instructions for guided steps (speech synthesis, when available). */
  voice: boolean;
  motion: MotionPreference;
  weeklyGoalMinutes: number;
  /** Privacy: when false, finished sessions are not written to the history. */
  recordHistory: boolean;
  /** Last configuration chosen for each exercise. */
  exerciseConfigs: Partial<Record<ExerciseId, ExerciseConfig>>;
}

export const WEEKLY_GOAL_RANGE = { min: 5, max: 1000 } as const;

export const DEFAULT_PREFERENCES: Preferences = {
  schemaVersion: 1,
  sound: true,
  soundTimbre: 'bol',
  volume: 65,
  haptics: true,
  voice: false,
  motion: 'system',
  weeklyGoalMinutes: 60,
  recordHistory: true,
  exerciseConfigs: {},
};

export interface PreferencesLoad {
  preferences: Preferences;
  /** True when stored preferences existed but were unreadable and defaults were used. */
  reset: boolean;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizePreferences(raw: unknown): Preferences {
  const d = DEFAULT_PREFERENCES;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...d, exerciseConfigs: {} };
  const r = raw as Record<string, unknown>;
  const goal = typeof r.weeklyGoalMinutes === 'number' && Number.isFinite(r.weeklyGoalMinutes) ? Math.round(r.weeklyGoalMinutes) : d.weeklyGoalMinutes;
  const volume = typeof r.volume === 'number' && Number.isFinite(r.volume) ? Math.round(r.volume) : d.volume;
  const exerciseConfigs: Partial<Record<ExerciseId, ExerciseConfig>> = {};
  if (r.exerciseConfigs && typeof r.exerciseConfigs === 'object') {
    const configs = r.exerciseConfigs as Record<string, unknown>;
    for (const id of EXERCISE_IDS) {
      if (configs[id] !== undefined) exerciseConfigs[id] = normalizeConfig(id, configs[id]);
    }
  }
  return {
    schemaVersion: 1,
    sound: bool(r.sound, d.sound),
    soundTimbre: r.soundTimbre === 'carillon' || r.soundTimbre === 'bol' ? r.soundTimbre : d.soundTimbre,
    volume: Math.min(100, Math.max(0, volume)),
    haptics: bool(r.haptics, d.haptics),
    voice: bool(r.voice, d.voice),
    motion: r.motion === 'reduce' || r.motion === 'system' ? r.motion : d.motion,
    weeklyGoalMinutes: Math.min(WEEKLY_GOAL_RANGE.max, Math.max(WEEKLY_GOAL_RANGE.min, goal)),
    recordHistory: bool(r.recordHistory, d.recordHistory),
    exerciseConfigs,
  };
}

export function loadPreferences(store: KeyValueStore): PreferencesLoad {
  const raw = safeRead(store, PREFERENCES_KEY);
  if (raw === null || raw === '') return { preferences: normalizePreferences(null), reset: false };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || (parsed as { schemaVersion?: unknown }).schemaVersion !== 1) {
      return { preferences: normalizePreferences(null), reset: true };
    }
    return { preferences: normalizePreferences(parsed), reset: false };
  } catch {
    return { preferences: normalizePreferences(null), reset: true };
  }
}

export function savePreferences(store: KeyValueStore, preferences: Preferences): WriteResult {
  return safeWrite(store, PREFERENCES_KEY, JSON.stringify(normalizePreferences(preferences)));
}

export function clearPreferences(store: KeyValueStore): WriteResult {
  return safeRemove(store, PREFERENCES_KEY);
}
