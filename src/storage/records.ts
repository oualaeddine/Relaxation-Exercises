import { isExerciseId, type Feeling, type SessionRecord } from '../domain/types';

const FEELINGS: readonly Feeling[] = ['leger', 'calme', 'tendu'];
const MAX_SECONDS = 24 * 60 * 60;

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

function nullableCount(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100_000) return value;
  return undefined;
}

/**
 * Validates an untrusted record (from localStorage or an imported backup).
 * Returns a clean copy containing only known fields, or `null` if the record is unusable.
 */
export function parseRecord(raw: unknown): SessionRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id.length === 0 || r.id.length > 100) return null;
  if (!isExerciseId(r.exerciseId)) return null;
  if (r.status !== 'completed' && r.status !== 'partial') return null;
  if (!isIsoDate(r.startedAt) || !isIsoDate(r.endedAt)) return null;
  if (Date.parse(r.endedAt) < Date.parse(r.startedAt)) return null;
  if (typeof r.activeSeconds !== 'number' || !Number.isInteger(r.activeSeconds)) return null;
  if (r.activeSeconds < 0 || r.activeSeconds > MAX_SECONDS) return null;
  const pausedSeconds = r.pausedSeconds === undefined ? 0 : r.pausedSeconds;
  if (typeof pausedSeconds !== 'number' || !Number.isInteger(pausedSeconds) || pausedSeconds < 0) return null;
  const targetSeconds = nullableCount(r.targetSeconds);
  const unitsTotal = nullableCount(r.unitsTotal);
  const unitsCompleted = nullableCount(r.unitsCompleted);
  const unitsSkipped = nullableCount(r.unitsSkipped);
  const cyclesCompleted = nullableCount(r.cyclesCompleted);
  if ([targetSeconds, unitsTotal, unitsCompleted, unitsSkipped, cyclesCompleted].includes(undefined)) return null;
  const feeling = r.feeling === undefined || r.feeling === null ? null : r.feeling;
  if (feeling !== null && !FEELINGS.includes(feeling as Feeling)) return null;
  return {
    id: r.id,
    exerciseId: r.exerciseId,
    status: r.status,
    startedAt: new Date(r.startedAt).toISOString(),
    endedAt: new Date(r.endedAt).toISOString(),
    activeSeconds: r.activeSeconds,
    pausedSeconds,
    targetSeconds: targetSeconds ?? null,
    unitsTotal: unitsTotal ?? null,
    unitsCompleted: unitsCompleted ?? null,
    unitsSkipped: unitsSkipped ?? null,
    cyclesCompleted: cyclesCompleted ?? null,
    feeling: feeling as Feeling | null,
  };
}

/** History order: most recent start first; ties broken by id for a stable order. */
export function sortRecords(records: readonly SessionRecord[]): SessionRecord[] {
  return [...records].sort((a, b) => {
    const diff = Date.parse(b.startedAt) - Date.parse(a.startedAt);
    if (diff !== 0) return diff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
