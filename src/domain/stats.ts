/**
 * Statistics derived exclusively from stored records.
 *
 * Rules
 * - Practice time = active seconds of `completed` and `partial` records (paused time is never
 *   counted). Any other status (e.g. a cancelled entry in an imported file) is ignored entirely.
 * - "Séances terminées" counts `completed` records only.
 * - A session belongs to the *local* calendar day on which it started (a session crossing
 *   midnight counts for the day it began). Weeks start on Monday (French convention).
 */
import { EXERCISES } from './exercises';
import type { ExerciseId, SessionRecord } from './types';

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] as const;
const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] as const;

const pad = (n: number): string => String(n).padStart(2, '0');

/** Local calendar day key, e.g. "2026-10-26". */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDayKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return dayKey(date) === key ? date : null;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Monday 00:00 (local) of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  const offset = (day.getDay() + 6) % 7; // Monday = 0
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - offset);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function countsAsPractice(record: SessionRecord): boolean {
  return record.status === 'completed' || record.status === 'partial';
}

export interface DayTotal {
  key: string;
  label: string;
  name: string;
  seconds: number;
  sessions: number;
  isToday: boolean;
}

export interface DistributionEntry {
  exerciseId: ExerciseId;
  sessions: number;
  seconds: number;
  /** Share of total practice time (0–1). */
  share: number;
}

export interface Stats {
  totalSeconds: number;
  totalSessions: number;
  completedSessions: number;
  partialSessions: number;
  last7Days: DayTotal[];
  weekSeconds: number;
  weekSessions: number;
  weeklyGoalSeconds: number;
  /** Progress toward the weekly goal, 0–1 (capped). */
  weeklyProgress: number;
  distribution: DistributionEntry[];
  /** Most practised exercise this week (by time), if any. */
  weekFavorite: DistributionEntry | null;
  recent: SessionRecord[];
}

function distributionOf(records: readonly SessionRecord[]): DistributionEntry[] {
  const total = records.reduce((sum, r) => sum + r.activeSeconds, 0);
  const map = new Map<ExerciseId, DistributionEntry>();
  for (const record of records) {
    const entry = map.get(record.exerciseId) ?? { exerciseId: record.exerciseId, sessions: 0, seconds: 0, share: 0 };
    entry.sessions += 1;
    entry.seconds += record.activeSeconds;
    map.set(record.exerciseId, entry);
  }
  const order = EXERCISES.map((e) => e.id);
  return [...map.values()]
    .map((e) => ({ ...e, share: total > 0 ? e.seconds / total : 0 }))
    .sort((a, b) => b.seconds - a.seconds || b.sessions - a.sessions || order.indexOf(a.exerciseId) - order.indexOf(b.exerciseId));
}

export function computeStats(records: readonly SessionRecord[], now: Date, weeklyGoalMinutes: number): Stats {
  const practice = records.filter(countsAsPractice);
  const today = startOfDay(now);
  const todayKey = dayKey(today);
  const days: DayTotal[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = addDays(today, -i);
    days.push({
      key: dayKey(d),
      label: DAY_LABELS[d.getDay()]!,
      name: DAY_NAMES[d.getDay()]!,
      seconds: 0,
      sessions: 0,
      isToday: dayKey(d) === todayKey,
    });
  }
  const byKey = new Map(days.map((d) => [d.key, d]));
  const weekStart = startOfWeek(now).getTime();
  const weekEnd = addDays(startOfWeek(now), 7).getTime();
  let weekSeconds = 0;
  const weekRecords: SessionRecord[] = [];
  for (const record of practice) {
    const started = new Date(record.startedAt);
    const day = byKey.get(dayKey(started));
    if (day) {
      day.seconds += record.activeSeconds;
      day.sessions += 1;
    }
    const t = started.getTime();
    if (t >= weekStart && t < weekEnd) {
      weekSeconds += record.activeSeconds;
      weekRecords.push(record);
    }
  }
  const weeklyGoalSeconds = Math.max(0, Math.round(weeklyGoalMinutes * 60));
  const weekDistribution = distributionOf(weekRecords);
  const sorted = [...practice].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  return {
    totalSeconds: practice.reduce((sum, r) => sum + r.activeSeconds, 0),
    totalSessions: practice.length,
    completedSessions: practice.filter((r) => r.status === 'completed').length,
    partialSessions: practice.filter((r) => r.status === 'partial').length,
    last7Days: days,
    weekSeconds,
    weekSessions: weekRecords.length,
    weeklyGoalSeconds,
    weeklyProgress: weeklyGoalSeconds > 0 ? Math.min(1, weekSeconds / weeklyGoalSeconds) : 0,
    distribution: distributionOf(practice),
    weekFavorite: weekDistribution[0] ?? null,
    recent: sorted.slice(0, 5),
  };
}

export interface RecordFilter {
  exerciseId?: ExerciseId | 'all';
  /** Inclusive local day keys ("YYYY-MM-DD"). */
  from?: string;
  to?: string;
}

/** Filters by exercise and by local start day (inclusive range). */
export function filterRecords(records: readonly SessionRecord[], filter: RecordFilter): SessionRecord[] {
  const from = filter.from ? parseDayKey(filter.from) : null;
  const to = filter.to ? parseDayKey(filter.to) : null;
  const fromMs = from ? from.getTime() : -Infinity;
  const toMs = to ? addDays(to, 1).getTime() : Infinity;
  return records.filter((record) => {
    if (!countsAsPractice(record)) return false;
    if (filter.exerciseId && filter.exerciseId !== 'all' && record.exerciseId !== filter.exerciseId) return false;
    const t = Date.parse(record.startedAt);
    return t >= fromMs && t < toMs;
  });
}

export function summarize(records: readonly SessionRecord[]): { sessions: number; seconds: number; completed: number } {
  const practice = records.filter(countsAsPractice);
  return {
    sessions: practice.length,
    seconds: practice.reduce((sum, r) => sum + r.activeSeconds, 0),
    completed: practice.filter((r) => r.status === 'completed').length,
  };
}
