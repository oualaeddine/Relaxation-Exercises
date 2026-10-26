import { describe, expect, it } from 'vitest';
import { normalizeConfig } from '../domain/config';
import type { ExerciseId } from '../domain/types';
import { cycleLengthMs, normalizePhases, pacedPhases } from './plan';
import {
  activeMsAt,
  applyCadence,
  createSession,
  pause,
  phaseAt,
  plannedCycles,
  resume,
  start,
  tick,
  type CadenceSegment,
  type TimeboxedSession,
} from './session';

const T0 = Date.UTC(2026, 9, 26, 8, 0, 0);
const S = 1000;

function paced(id: ExerciseId, config: Record<string, unknown> = {}): TimeboxedSession {
  const session = createSession(id, normalizeConfig(id, config), T0, 'test');
  if (session.family !== 'timeboxed') throw new Error('expected timeboxed');
  return session;
}

const segmentsOf = (s: TimeboxedSession): CadenceSegment[] => s.segments;

describe('slow breathing (4 s inhale / 6 s exhale)', () => {
  const session = paced('respiration-lente');
  const segments = segmentsOf(session);

  it('starts with inhalation', () => {
    expect(phaseAt(segments, 0).phase.key).toBe('inhale');
    expect(phaseAt(segments, 0).phaseRemainingMs).toBe(4 * S);
  });

  it('inhales for exactly four seconds then exhales', () => {
    expect(phaseAt(segments, 3999).phase.key).toBe('inhale');
    expect(phaseAt(segments, 4000).phase.key).toBe('exhale');
    expect(phaseAt(segments, 4000).phaseRemainingMs).toBe(6 * S);
  });

  it('exhales for exactly six seconds', () => {
    expect(phaseAt(segments, 9999).phase.key).toBe('exhale');
    expect(phaseAt(segments, 9999).phaseRemainingMs).toBe(1);
    expect(phaseAt(segments, 10_000).phase.key).toBe('inhale');
  });

  it('has a ten-second cycle', () => {
    expect(cycleLengthMs(segments[0]!.phases)).toBe(10 * S);
    expect(phaseAt(segments, 10_000).cycleIndex).toBe(1);
    expect(phaseAt(segments, 25_000).cycleIndex).toBe(2);
  });

  it('has no gaps or duplicated phases at cycle boundaries', () => {
    const sequence: string[] = [];
    for (let t = 0; t < 60_000; t += 250) {
      const key = `${phaseAt(segments, t).cycleIndex}:${phaseAt(segments, t).phase.key}`;
      if (sequence[sequence.length - 1] !== key) sequence.push(key);
    }
    expect(sequence).toHaveLength(12);
    sequence.forEach((key, i) => {
      expect(key).toBe(`${Math.floor(i / 2)}:${i % 2 === 0 ? 'inhale' : 'exhale'}`);
    });
  });

  it('phase elapsed + remaining always equals the phase duration (single timing source)', () => {
    for (let t = 0; t < 30_000; t += 333) {
      const info = phaseAt(segments, t);
      expect(info.phaseElapsedMs + info.phaseRemainingMs).toBe(info.phase.durationMs);
      expect(info.phaseElapsedMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('supports configurable phase durations', () => {
    const custom = paced('respiration-lente', { inhaleSec: 5, exhaleSec: 8 });
    expect(custom.segments[0]!.phases.map((p) => p.durationMs)).toEqual([5000, 8000]);
    expect(phaseAt(custom.segments, 12_999).phase.key).toBe('exhale');
    expect(phaseAt(custom.segments, 13_000).cycleIndex).toBe(1);
  });

  it('normalises invalid durations to safe defaults', () => {
    const invalid = paced('respiration-lente', { inhaleSec: 0, exhaleSec: Number.POSITIVE_INFINITY });
    expect(invalid.segments[0]!.phases.map((p) => p.durationMs)).toEqual([4000, 6000]);
    expect(normalizePhases([{ key: 'inhale', durationMs: 0 }, { key: 'exhale', durationMs: -5 }])).toBeNull();
    expect(normalizePhases([{ key: 'inhale', durationMs: 50 }, { key: 'exhale', durationMs: 99_999 }])).toEqual([
      { key: 'inhale', durationMs: 1000 },
      { key: 'exhale', durationMs: 20_000 },
    ]);
  });

  it('plans 30 cycles in five minutes and stops exactly at the configured duration', () => {
    expect(plannedCycles(session)).toBe(30);
    let s = start(session, T0);
    s = tick(s, T0 + 299_999);
    expect(s.status).toBe('running');
    s = tick(s, T0 + 300_000);
    expect(s.status).toBe('completed');
    expect(s.finalActiveMs).toBe(300_000);
  });
});

describe('box breathing', () => {
  it('holds are disabled by default (inhale → exhale)', () => {
    const s = paced('respiration-carree');
    expect(s.segments[0]!.phases.map((p) => p.key)).toEqual(['inhale', 'exhale']);
    expect(cycleLengthMs(s.segments[0]!.phases)).toBe(8 * S);
  });

  it('runs all four phases in order when both holds are enabled', () => {
    const s = paced('respiration-carree', { holdInEnabled: true, holdOutEnabled: true });
    const keys = [0, 4000, 8000, 12_000, 16_000].map((t) => phaseAt(s.segments, t).phase.key);
    expect(keys).toEqual(['inhale', 'hold-in', 'exhale', 'hold-out', 'inhale']);
    expect(cycleLengthMs(s.segments[0]!.phases)).toBe(16 * S);
    expect(plannedCycles(s)).toBe(15);
  });

  it('skips a disabled hold', () => {
    const onlyTop = paced('respiration-carree', { holdInEnabled: true });
    expect(onlyTop.segments[0]!.phases.map((p) => p.key)).toEqual(['inhale', 'hold-in', 'exhale']);
    const onlyBottom = paced('respiration-carree', { holdOutEnabled: true });
    expect(onlyBottom.segments[0]!.phases.map((p) => p.key)).toEqual(['inhale', 'exhale', 'hold-out']);
    expect(phaseAt(onlyBottom.segments, 8000).phase.key).toBe('hold-out');
    expect(phaseAt(onlyBottom.segments, 12_000).phase.key).toBe('inhale');
  });

  it('applies custom phase durations and recomputes cycle length', () => {
    const s = paced('respiration-carree', { inhaleSec: 5, exhaleSec: 7, holdInEnabled: true, holdInSec: 3 });
    expect(s.segments[0]!.phases.map((p) => p.durationMs)).toEqual([5000, 3000, 7000]);
    expect(cycleLengthMs(s.segments[0]!.phases)).toBe(15 * S);
  });

  it('changing the cadence mid-session starts at the next cycle boundary', () => {
    let s: ReturnType<typeof start> = start(paced('respiration-carree'), T0);
    s = applyCadence(s, pacedPhases('respiration-carree', normalizeConfig('respiration-carree', { holdInEnabled: true, holdOutEnabled: true })), T0 + 5000);
    if (s.family !== 'timeboxed') throw new Error();
    // Current 8 s cycle (inhale 4 + exhale 4) is not cut.
    expect(phaseAt(s.segments, 5000).phase.key).toBe('exhale');
    expect(phaseAt(s.segments, 8000).phase.key).toBe('inhale');
    expect(phaseAt(s.segments, 12_000).phase.key).toBe('hold-in');
    expect(phaseAt(s.segments, 8000).cycleIndex).toBe(1);
    expect(cycleLengthMs(phaseAt(s.segments, 9000).segment.phases)).toBe(16 * S);
  });

  it('changing the cadence while paused restarts with an inhalation', () => {
    let s: ReturnType<typeof start> = start(paced('respiration-carree'), T0);
    s = pause(s, T0 + 6000);
    s = applyCadence(s, [
      { key: 'inhale', durationMs: 3000 },
      { key: 'exhale', durationMs: 3000 },
    ], T0 + 7000);
    s = resume(s, T0 + 9000);
    if (s.family !== 'timeboxed') throw new Error();
    const active = activeMsAt(s, T0 + 9000);
    expect(active).toBe(6000);
    expect(phaseAt(s.segments, active).phase.key).toBe('inhale');
    expect(phaseAt(s.segments, active).phaseRemainingMs).toBe(3000);
    expect(phaseAt(s.segments, active).cycleIndex).toBe(1);
  });
});

describe('pursed-lip breathing', () => {
  it('uses the 2 s / 4 s default pattern', () => {
    const s = paced('expiration-levres-pincees');
    expect(s.segments[0]!.phases).toEqual([
      { key: 'inhale', durationMs: 2000 },
      { key: 'exhale', durationMs: 4000 },
    ]);
    expect(phaseAt(s.segments, 1999).phase.key).toBe('inhale');
    expect(phaseAt(s.segments, 2000).phase.key).toBe('exhale');
    expect(phaseAt(s.segments, 6000).phase.key).toBe('inhale');
    expect(plannedCycles(s)).toBe(20);
  });
});
