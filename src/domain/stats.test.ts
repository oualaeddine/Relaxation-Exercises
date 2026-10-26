import { describe, expect, it } from 'vitest';
import { HistoryRepository } from '../storage/history';
import { MemoryStore } from '../storage/store';
import { computeStats, dayKey, filterRecords, startOfWeek, summarize } from './stats';
import type { SessionRecord } from './types';

/** Builds a record from a *local* (Europe/Paris, set in vite.config.ts) date-time. */
function rec(id: string, local: [number, number, number, number, number], overrides: Partial<SessionRecord> = {}): SessionRecord {
  const [y, m, d, h, min] = local;
  const start = new Date(y, m - 1, d, h, min);
  const activeSeconds = overrides.activeSeconds ?? 300;
  return {
    id,
    exerciseId: 'respiration-lente',
    status: 'completed',
    startedAt: start.toISOString(),
    endedAt: new Date(start.getTime() + (activeSeconds + (overrides.pausedSeconds ?? 0)) * 1000).toISOString(),
    activeSeconds,
    pausedSeconds: 0,
    targetSeconds: 300,
    unitsTotal: null,
    unitsCompleted: null,
    unitsSkipped: null,
    cyclesCompleted: null,
    feeling: null,
    ...overrides,
  };
}

// Monday 26 October 2026, 10:00 local. DST ended on Sunday 25 October 2026 in Europe/Paris.
const NOW = new Date(2026, 9, 26, 10, 0);

describe('time zone setup', () => {
  it('runs tests in Europe/Paris', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Paris');
    expect(new Date(2026, 9, 26, 10, 0).getTimezoneOffset()).toBe(-60);
    expect(new Date(2026, 9, 24, 10, 0).getTimezoneOffset()).toBe(-120);
  });
});

describe('computeStats', () => {
  it('handles an empty history', () => {
    const stats = computeStats([], NOW, 60);
    expect(stats).toMatchObject({
      totalSeconds: 0,
      totalSessions: 0,
      completedSessions: 0,
      weekSeconds: 0,
      weeklyProgress: 0,
      weekFavorite: null,
    });
    expect(stats.last7Days).toHaveLength(7);
    expect(stats.last7Days.every((d) => d.seconds === 0)).toBe(true);
    expect(stats.distribution).toEqual([]);
    expect(stats.recent).toEqual([]);
  });

  it('handles one completed session', () => {
    const stats = computeStats([rec('a', [2026, 10, 26, 8, 0])], NOW, 60);
    expect(stats).toMatchObject({ totalSeconds: 300, totalSessions: 1, completedSessions: 1, weekSeconds: 300, weekSessions: 1 });
    expect(stats.last7Days[6]).toMatchObject({ key: '2026-10-26', label: 'Lun', seconds: 300, sessions: 1, isToday: true });
    expect(stats.weeklyProgress).toBeCloseTo(300 / 3600);
  });

  it('adds several sessions on the same day', () => {
    const stats = computeStats([rec('a', [2026, 10, 26, 7, 0]), rec('b', [2026, 10, 26, 8, 0], { activeSeconds: 120 })], NOW, 60);
    expect(stats.last7Days[6]).toMatchObject({ seconds: 420, sessions: 2 });
  });

  it('builds daily totals for the previous seven days, oldest first', () => {
    const stats = computeStats(
      [rec('old', [2026, 10, 19, 9, 0]), rec('d1', [2026, 10, 20, 9, 0]), rec('d6', [2026, 10, 25, 9, 0], { activeSeconds: 60 })],
      NOW,
      60,
    );
    expect(stats.last7Days.map((d) => d.key)).toEqual([
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ]);
    expect(stats.last7Days.map((d) => d.seconds)).toEqual([300, 0, 0, 0, 0, 60, 0]);
    expect(stats.totalSeconds).toBe(660); // totals include older sessions
  });

  it('separates sessions across a week boundary (weeks start on Monday)', () => {
    const records = [rec('sun', [2026, 10, 25, 23, 30]), rec('mon', [2026, 10, 26, 0, 10], { activeSeconds: 120 })];
    const stats = computeStats(records, NOW, 60);
    expect(stats.weekSeconds).toBe(120);
    expect(stats.weekSessions).toBe(1);
    expect(startOfWeek(NOW).getDate()).toBe(26);
    expect(startOfWeek(new Date(2026, 9, 25, 23, 0)).getDate()).toBe(19);
  });

  it('attributes a session crossing midnight to the day it started', () => {
    const stats = computeStats([rec('late', [2026, 10, 25, 23, 55], { activeSeconds: 600 })], NOW, 60);
    expect(stats.last7Days.find((d) => d.key === '2026-10-25')!.seconds).toBe(600);
    expect(stats.last7Days.find((d) => d.key === '2026-10-26')!.seconds).toBe(0);
  });

  it('uses local calendar days, including across the DST change', () => {
    // 00:30 local on 25 Oct is still 24 Oct in UTC.
    const r = rec('dst', [2026, 10, 25, 0, 30]);
    expect(r.startedAt.startsWith('2026-10-24')).toBe(true);
    expect(dayKey(new Date(r.startedAt))).toBe('2026-10-25');
    expect(computeStats([r], NOW, 60).last7Days.find((d) => d.key === '2026-10-25')!.sessions).toBe(1);
  });

  it('counts partial sessions as practice time but not as completed sessions', () => {
    const stats = computeStats([rec('c', [2026, 10, 26, 8, 0]), rec('p', [2026, 10, 26, 9, 0], { status: 'partial', activeSeconds: 45 })], NOW, 60);
    expect(stats).toMatchObject({ totalSeconds: 345, totalSessions: 2, completedSessions: 1, partialSessions: 1 });
  });

  it('ignores cancelled entries entirely', () => {
    const cancelled = { ...rec('x', [2026, 10, 26, 8, 0]), status: 'cancelled' } as unknown as SessionRecord;
    const stats = computeStats([cancelled], NOW, 60);
    expect(stats).toMatchObject({ totalSeconds: 0, totalSessions: 0, completedSessions: 0 });
  });

  it('never adds paused time to practice time', () => {
    const stats = computeStats([rec('p', [2026, 10, 26, 8, 0], { activeSeconds: 50, pausedSeconds: 600 })], NOW, 60);
    expect(stats.totalSeconds).toBe(50);
  });

  it('computes weekly target progress (capped at 100 %)', () => {
    const records = [rec('a', [2026, 10, 26, 8, 0], { activeSeconds: 1800 })];
    expect(computeStats(records, NOW, 60).weeklyProgress).toBe(0.5);
    expect(computeStats(records, NOW, 15).weeklyProgress).toBe(1);
  });

  it('computes exercise distribution and the favourite of the week', () => {
    const stats = computeStats(
      [
        rec('a', [2026, 10, 26, 8, 0], { activeSeconds: 600 }),
        rec('b', [2026, 10, 26, 9, 0], { exerciseId: 'scan-corporel', activeSeconds: 200 }),
        rec('c', [2026, 10, 26, 9, 30], { exerciseId: 'scan-corporel', activeSeconds: 200 }),
      ],
      NOW,
      60,
    );
    expect(stats.distribution.map((d) => [d.exerciseId, d.sessions, d.seconds])).toEqual([
      ['respiration-lente', 1, 600],
      ['scan-corporel', 2, 400],
    ]);
    expect(stats.distribution[0]!.share).toBeCloseTo(0.6);
    expect(stats.weekFavorite?.exerciseId).toBe('respiration-lente');
  });

  it('lists recent sessions most recent first', () => {
    const stats = computeStats([rec('a', [2026, 10, 20, 8, 0]), rec('b', [2026, 10, 26, 8, 0])], NOW, 60);
    expect(stats.recent.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('reflects deletion of a session after statistics were calculated', () => {
    const repo = new HistoryRepository(new MemoryStore());
    repo.add(rec('a', [2026, 10, 26, 8, 0]));
    repo.add(rec('b', [2026, 10, 26, 9, 0], { activeSeconds: 100 }));
    expect(computeStats(repo.all(), NOW, 60).totalSeconds).toBe(400);
    repo.remove('a');
    expect(computeStats(repo.all(), NOW, 60)).toMatchObject({ totalSeconds: 100, totalSessions: 1 });
  });
});

describe('filterRecords', () => {
  const records = [
    rec('a', [2026, 10, 20, 8, 0]),
    rec('b', [2026, 10, 22, 23, 59], { exerciseId: 'scan-corporel' }),
    rec('c', [2026, 10, 23, 0, 0]),
  ];

  it('filters by exercise', () => {
    expect(filterRecords(records, { exerciseId: 'scan-corporel' }).map((r) => r.id)).toEqual(['b']);
    expect(filterRecords(records, { exerciseId: 'all' })).toHaveLength(3);
  });

  it('filters by inclusive local date range', () => {
    expect(filterRecords(records, { from: '2026-10-21', to: '2026-10-22' }).map((r) => r.id)).toEqual(['b']);
    expect(filterRecords(records, { from: '2026-10-23' }).map((r) => r.id)).toEqual(['c']);
    expect(filterRecords(records, { to: '2026-10-20' }).map((r) => r.id)).toEqual(['a']);
  });

  it('ignores malformed date bounds', () => {
    expect(filterRecords(records, { from: '2026-13-45' })).toHaveLength(3);
  });

  it('summarises a filtered list', () => {
    expect(summarize(filterRecords(records, { exerciseId: 'respiration-lente' }))).toEqual({ sessions: 2, seconds: 600, completed: 2 });
  });
});
