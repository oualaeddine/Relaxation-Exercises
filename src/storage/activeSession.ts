import { normalizeConfig } from '../domain/config';
import { isExerciseId } from '../domain/types';
import { recover, type Session } from '../engine/session';
import { safeRead, safeRemove, safeWrite, type KeyValueStore, type WriteResult } from './store';

export const ACTIVE_SESSION_KEY = 'calme.activeSession';
/** Snapshots older than this are discarded on load (never recorded). */
export const ACTIVE_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface Snapshot {
  schemaVersion: 1;
  savedAt: number;
  session: Session;
}

/**
 * Persists the live session. Called on lifecycle transitions and by a throttled checkpoint
 * (see `CHECKPOINT_INTERVAL_MS` in the session hook) — never on every timer tick.
 */
export function saveActiveSession(store: KeyValueStore, session: Session, savedAt: number): WriteResult {
  const snapshot: Snapshot = { schemaVersion: 1, savedAt, session };
  return safeWrite(store, ACTIVE_SESSION_KEY, JSON.stringify(snapshot));
}

export function clearActiveSession(store: KeyValueStore): WriteResult {
  return safeRemove(store, ACTIVE_SESSION_KEY);
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const nullableNum = (v: unknown): boolean => v === null || num(v);

function isSessionShape(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  if (s.version !== 1 || typeof s.id !== 'string' || !isExerciseId(s.exerciseId)) return false;
  if (!['idle', 'running', 'paused'].includes(s.status as string)) return false;
  if (!num(s.createdAt) || !num(s.accumulatedMs) || !num(s.pausedMs)) return false;
  if (!nullableNum(s.startedAt) || !nullableNum(s.runningSince) || !nullableNum(s.pausedSince)) return false;
  if (s.status === 'running' && !num(s.runningSince)) return false;
  if (s.family === 'timeboxed') {
    return num(s.targetMs) && Array.isArray(s.segments);
  }
  if (s.family === 'sequence') {
    return (
      Array.isArray(s.steps) &&
      s.steps.length > 0 &&
      Array.isArray(s.unitKeys) &&
      Array.isArray(s.outcomes) &&
      Array.isArray(s.excluded) &&
      num(s.stepIndex) &&
      (s.stepIndex as number) >= 0 &&
      (s.stepIndex as number) < s.steps.length &&
      num(s.stepStartedMs)
    );
  }
  return false;
}

/**
 * Loads the in-progress session, applying the recovery rule (see `recover`): a running session
 * is restored as paused with active time credited only up to its last checkpoint.
 * Invalid or expired snapshots are removed and `null` is returned.
 */
export function loadActiveSession(store: KeyValueStore, now: number): Session | null {
  const raw = safeRead(store, ACTIVE_SESSION_KEY);
  if (!raw) return null;
  try {
    const snapshot = JSON.parse(raw) as Partial<Snapshot>;
    if (snapshot.schemaVersion !== 1 || !num(snapshot.savedAt) || !isSessionShape(snapshot.session)) {
      clearActiveSession(store);
      return null;
    }
    if (now - snapshot.savedAt > ACTIVE_SESSION_MAX_AGE_MS) {
      clearActiveSession(store);
      return null;
    }
    const session = { ...snapshot.session, config: normalizeConfig(snapshot.session.exerciseId, snapshot.session.config) };
    return recover(session, snapshot.savedAt, now);
  } catch {
    clearActiveSession(store);
    return null;
  }
}
