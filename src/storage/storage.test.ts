import { describe, expect, it } from 'vitest';
import { normalizeConfig } from '../domain/config';
import type { SessionRecord } from '../domain/types';
import { createSession, pause, start, activeMsAt, nextStep, type Session } from '../engine/session';
import { ACTIVE_SESSION_KEY, ACTIVE_SESSION_MAX_AGE_MS, clearActiveSession, loadActiveSession, saveActiveSession } from './activeSession';
import { HISTORY_BACKUP_PREFIX, HISTORY_KEY, HistoryRepository, loadHistory } from './history';
import { DEFAULT_PREFERENCES, PREFERENCES_KEY, loadPreferences, savePreferences } from './preferences';
import { MemoryStore, safeWrite, type KeyValueStore } from './store';

const T0 = Date.UTC(2026, 9, 26, 8, 0, 0);

function record(id: string, startedAt: string, overrides: Partial<SessionRecord> = {}): SessionRecord {
  const start = Date.parse(startedAt);
  return {
    id,
    exerciseId: 'respiration-lente',
    status: 'completed',
    startedAt: new Date(start).toISOString(),
    endedAt: new Date(start + 300_000).toISOString(),
    activeSeconds: 300,
    pausedSeconds: 0,
    targetSeconds: 300,
    unitsTotal: null,
    unitsCompleted: null,
    unitsSkipped: null,
    cyclesCompleted: 30,
    feeling: null,
    ...overrides,
  };
}

/** A store whose writes can be made to fail (quota exceeded). */
class FailingStore extends MemoryStore {
  failWrites = false;
  override setItem(key: string, value: string): void {
    if (this.failWrites) {
      const error = new Error('Quota');
      error.name = 'QuotaExceededError';
      throw error;
    }
    super.setItem(key, value);
  }
}

// The production adapter is window.localStorage (jsdom implements the real Storage API).
const local = (): KeyValueStore => window.localStorage;

describe('history persistence (localStorage)', () => {
  it('loads an empty history', () => {
    const repo = new HistoryRepository(local());
    expect(repo.all()).toEqual([]);
    expect(repo.issues).toEqual([]);
  });

  it('a completed session survives a reload', () => {
    new HistoryRepository(local()).add(record('a', '2026-10-26T08:00:00Z'));
    const reloaded = new HistoryRepository(local());
    expect(reloaded.all().map((r) => r.id)).toEqual(['a']);
    expect(JSON.parse(window.localStorage.getItem(HISTORY_KEY)!)).toMatchObject({ schemaVersion: 1 });
  });

  it('repeated completion events create only one record', () => {
    const repo = new HistoryRepository(local());
    const r = record('same', '2026-10-26T08:00:00Z');
    repo.add(r);
    repo.add(r);
    repo.add({ ...r });
    expect(new HistoryRepository(local()).all()).toHaveLength(1);
  });

  it('keeps history sorted by start time, most recent first', () => {
    const repo = new HistoryRepository(local());
    repo.add(record('b', '2026-10-24T08:00:00Z'));
    repo.add(record('c', '2026-10-26T09:00:00Z'));
    repo.add(record('a', '2026-10-25T08:00:00Z'));
    expect(repo.all().map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });

  it('invalid JSON does not crash and is backed up', () => {
    window.localStorage.setItem(HISTORY_KEY, '{not json');
    const repo = new HistoryRepository(local(), T0);
    expect(repo.all()).toEqual([]);
    expect(repo.issues[0]).toMatchObject({ kind: 'corrupt', backupKey: `${HISTORY_BACKUP_PREFIX}${T0}` });
    expect(window.localStorage.getItem(`${HISTORY_BACKUP_PREFIX}${T0}`)).toBe('{not json');
    // New sessions can still be recorded.
    expect(repo.add(record('new', '2026-10-26T08:00:00Z')).ok).toBe(true);
  });

  it('a corrupt individual record does not hide the others, and is not silently deleted', () => {
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify({
        schemaVersion: 1,
        sessions: [record('ok', '2026-10-26T08:00:00Z'), { id: 'bad', activeSeconds: 'x' }, 42],
      }),
    );
    const repo = new HistoryRepository(local());
    expect(repo.all().map((r) => r.id)).toEqual(['ok']);
    expect(repo.invalidCount).toBe(2);
    expect(repo.issues).toContainEqual({ kind: 'invalid-records', count: 2 });
    repo.add(record('ok2', '2026-10-26T09:00:00Z'));
    const stored = JSON.parse(window.localStorage.getItem(HISTORY_KEY)!) as { sessions: unknown[] };
    expect(stored.sessions).toHaveLength(4);
    repo.discardInvalid();
    expect(new HistoryRepository(local()).invalidCount).toBe(0);
  });

  it('unsupported (newer) schema versions are backed up, not overwritten', () => {
    const future = JSON.stringify({ schemaVersion: 99, sessions: [] });
    window.localStorage.setItem(HISTORY_KEY, future);
    const repo = new HistoryRepository(local(), T0);
    expect(repo.issues[0]).toMatchObject({ kind: 'unsupported-version', version: 99 });
    expect(window.localStorage.getItem(`${HISTORY_BACKUP_PREFIX}${T0}`)).toBe(future);
  });

  it('blocks writes when the unreadable data cannot be backed up', () => {
    const store = new FailingStore();
    store.setItem(HISTORY_KEY, '{broken');
    store.failWrites = true;
    const repo = new HistoryRepository(store, T0);
    expect(repo.isBlocked).toBe(true);
    store.failWrites = false;
    expect(repo.add(record('x', '2026-10-26T08:00:00Z')).ok).toBe(false);
    expect(store.getItem(HISTORY_KEY)).toBe('{broken');
    // Explicit user reset unblocks.
    expect(repo.clear().ok).toBe(true);
    expect(repo.add(record('x', '2026-10-26T08:00:00Z')).ok).toBe(true);
  });

  it('migrates legacy v0 (bare array) data and preserves valid records', () => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([record('legacy', '2026-10-20T08:00:00Z'), { nope: true }]));
    const repo = new HistoryRepository(local());
    expect(repo.all().map((r) => r.id)).toEqual(['legacy']);
    expect(repo.issues).toContainEqual({ kind: 'migrated', from: 0 });
    const stored = JSON.parse(window.localStorage.getItem(HISTORY_KEY)!) as { schemaVersion: number; sessions: unknown[] };
    expect(stored.schemaVersion).toBe(1);
    expect(stored.sessions).toHaveLength(2);
  });

  it('write failures are reported and leave the in-memory state unchanged', () => {
    const store = new FailingStore();
    const repo = new HistoryRepository(store);
    repo.add(record('a', '2026-10-26T08:00:00Z'));
    store.failWrites = true;
    expect(repo.add(record('b', '2026-10-26T09:00:00Z'))).toEqual({ ok: false, error: 'quota' });
    expect(repo.all().map((r) => r.id)).toEqual(['a']);
    expect(repo.remove('a')).toEqual({ ok: false, error: 'quota' });
    expect(repo.all()).toHaveLength(1);
    store.failWrites = false;
    expect(repo.add(record('b', '2026-10-26T09:00:00Z')).ok).toBe(true);
  });

  it('deleting history removes records, invalid entries and backups', () => {
    window.localStorage.setItem(HISTORY_KEY, '{bad');
    const repo = new HistoryRepository(local(), T0);
    repo.add(record('a', '2026-10-26T08:00:00Z'));
    expect(repo.clear().ok).toBe(true);
    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
    expect(window.localStorage.getItem(`${HISTORY_BACKUP_PREFIX}${T0}`)).toBeNull();
    expect(new HistoryRepository(local()).all()).toEqual([]);
  });

  it('import merges without replacing and ignores duplicate ids', () => {
    const repo = new HistoryRepository(local());
    repo.add(record('a', '2026-10-26T08:00:00Z', { activeSeconds: 100 }));
    const result = repo.importRecords([
      record('a', '2026-10-26T08:00:00Z', { activeSeconds: 999 }),
      record('b', '2026-10-25T08:00:00Z'),
      record('b', '2026-10-25T08:00:00Z'),
    ]);
    expect(result).toMatchObject({ ok: true, added: 1, duplicates: 2 });
    expect(repo.all().find((r) => r.id === 'a')!.activeSeconds).toBe(100);
    expect(repo.all()).toHaveLength(2);
  });

  it('updates the feeling of an existing record without duplicating it', () => {
    const repo = new HistoryRepository(local());
    repo.add(record('a', '2026-10-26T08:00:00Z'));
    repo.setFeeling('a', 'calme');
    const reloaded = new HistoryRepository(local()).all();
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]!.feeling).toBe('calme');
  });

  it('rejects records with impossible values', () => {
    window.localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify({
        schemaVersion: 1,
        sessions: [
          record('neg', '2026-10-26T08:00:00Z', { activeSeconds: -5 }),
          record('order', '2026-10-26T08:00:00Z', { endedAt: '2026-10-25T08:00:00.000Z' }),
          { ...record('ex', '2026-10-26T08:00:00Z'), exerciseId: 'inconnu' },
          { ...record('st', '2026-10-26T08:00:00Z'), status: 'cancelled' },
        ],
      }),
    );
    expect(loadHistory(local()).records).toEqual([]);
  });
});

describe('preferences', () => {
  it('survive a reload, including the weekly goal', () => {
    savePreferences(local(), { ...DEFAULT_PREFERENCES, weeklyGoalMinutes: 90, sound: false, recordHistory: false });
    const { preferences } = loadPreferences(local());
    expect(preferences).toMatchObject({ weeklyGoalMinutes: 90, sound: false, recordHistory: false });
  });

  it('fall back to defaults when unreadable', () => {
    window.localStorage.setItem(PREFERENCES_KEY, '[[[');
    expect(loadPreferences(local())).toEqual({ preferences: DEFAULT_PREFERENCES, reset: true });
  });

  it('normalise out-of-range values and exercise configurations', () => {
    window.localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({
        schemaVersion: 1,
        weeklyGoalMinutes: -10,
        volume: 400,
        exerciseConfigs: { 'respiration-lente': { inhaleSec: 0 }, inconnu: {} },
      }),
    );
    const { preferences } = loadPreferences(local());
    expect(preferences.weeklyGoalMinutes).toBe(5);
    expect(preferences.volume).toBe(100);
    expect(preferences.exerciseConfigs['respiration-lente']).toEqual(normalizeConfig('respiration-lente'));
    expect(Object.keys(preferences.exerciseConfigs)).toEqual(['respiration-lente']);
  });

  it('report write failures', () => {
    const store = new FailingStore();
    store.failWrites = true;
    expect(savePreferences(store, DEFAULT_PREFERENCES)).toEqual({ ok: false, error: 'quota' });
    expect(safeWrite(store, 'x', 'y')).toEqual({ ok: false, error: 'quota' });
  });
});

describe('active session snapshot', () => {
  const slow = (): Session => createSession('respiration-lente', normalizeConfig('respiration-lente'), T0, 'live');

  it('restores a paused session as-is', () => {
    const paused = pause(start(slow(), T0), T0 + 20_000);
    saveActiveSession(local(), paused, T0 + 20_000);
    const restored = loadActiveSession(local(), T0 + 3_600_000)!;
    expect(restored.status).toBe('paused');
    expect(activeMsAt(restored, T0 + 3_600_000)).toBe(20_000);
  });

  it('restores a running session as paused at its last checkpoint', () => {
    const running = start(slow(), T0);
    saveActiveSession(local(), running, T0 + 45_000);
    const restored = loadActiveSession(local(), T0 + 600_000)!;
    expect(restored.status).toBe('paused');
    expect(activeMsAt(restored, T0 + 600_000)).toBe(45_000);
  });

  it('a running session whose target passed before the checkpoint completes at its target', () => {
    const running = start(slow(), T0);
    saveActiveSession(local(), running, T0 + 400_000);
    const restored = loadActiveSession(local(), T0 + 500_000)!;
    expect(restored.status).toBe('completed');
    expect(restored.finalActiveMs).toBe(300_000);
  });

  it('keeps the exercise and step position of a guided session', () => {
    let s: Session = start(createSession('ancrage-sensoriel', normalizeConfig('ancrage-sensoriel'), T0), T0);
    s = nextStep(s, T0 + 10_000);
    s = nextStep(s, T0 + 20_000);
    saveActiveSession(local(), s, T0 + 25_000);
    const restored = loadActiveSession(local(), T0 + 30_000)!;
    expect(restored.exerciseId).toBe('ancrage-sensoriel');
    expect(restored.family === 'sequence' && restored.stepIndex).toBe(2);
  });

  it('discards invalid and expired snapshots without recording them', () => {
    window.localStorage.setItem(ACTIVE_SESSION_KEY, '{"schemaVersion":1,"savedAt":1,"session":{"version":1}}');
    expect(loadActiveSession(local(), T0)).toBeNull();
    expect(window.localStorage.getItem(ACTIVE_SESSION_KEY)).toBeNull();
    window.localStorage.setItem(ACTIVE_SESSION_KEY, 'garbage');
    expect(loadActiveSession(local(), T0)).toBeNull();
    saveActiveSession(local(), pause(start(slow(), T0), T0 + 1000), T0 + 1000);
    expect(loadActiveSession(local(), T0 + 1000 + ACTIVE_SESSION_MAX_AGE_MS + 1)).toBeNull();
    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
  });

  it('can be cleared', () => {
    saveActiveSession(local(), start(slow(), T0), T0);
    clearActiveSession(local());
    expect(loadActiveSession(local(), T0)).toBeNull();
  });
});
