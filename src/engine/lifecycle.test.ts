import { describe, expect, it } from 'vitest';
import { normalizeConfig } from '../domain/config';
import { formatClock, formatDuration, formatRemaining, phaseSeconds } from '../domain/format';
import { HistoryRepository } from '../storage/history';
import { MemoryStore } from '../storage/store';
import {
  activeMsAt,
  cancel,
  createSession,
  finishEarly,
  nextStep,
  pause,
  pausedMsAt,
  phaseAt,
  recover,
  resume,
  start,
  tick,
  toRecord,
  type Session,
} from './session';

const T0 = Date.UTC(2026, 9, 26, 8, 0, 0);
const S = 1000;

const slow = (): Session => createSession('respiration-lente', normalizeConfig('respiration-lente'), T0, 'slow-1');

describe('session state machine', () => {
  it('idle → running → paused → running → completed', () => {
    let s = slow();
    expect(s.status).toBe('idle');
    s = start(s, T0);
    expect(s.status).toBe('running');
    s = pause(s, T0 + 10 * S);
    expect(s.status).toBe('paused');
    s = resume(s, T0 + 20 * S);
    expect(s.status).toBe('running');
    s = tick(s, T0 + 310 * S);
    expect(s.status).toBe('completed');
    expect(s.finalActiveMs).toBe(300 * S);
    expect(s.endedAt).toBe(T0 + 310 * S);
  });

  it('running → partial', () => {
    const s = finishEarly(start(slow(), T0), T0 + 42 * S);
    expect(s.status).toBe('partial');
    expect(s.finalActiveMs).toBe(42 * S);
  });

  it('idle → cancelled, running → cancelled, paused → cancelled', () => {
    expect(cancel(slow(), T0).status).toBe('cancelled');
    expect(cancel(start(slow(), T0), T0 + S).status).toBe('cancelled');
    expect(cancel(pause(start(slow(), T0), T0 + S), T0 + 2 * S).status).toBe('cancelled');
  });

  it('cancelled sessions never produce a record', () => {
    const s = cancel(start(slow(), T0), T0 + 120 * S);
    expect(toRecord(s)).toBeNull();
  });

  it('partial completion followed by history finalisation creates exactly one record', () => {
    const repo = new HistoryRepository(new MemoryStore());
    const s = finishEarly(start(slow(), T0), T0 + 60 * S);
    const record = toRecord(s)!;
    expect(repo.add(record)).toEqual({ ok: true });
    expect(repo.add(record)).toEqual({ ok: true, duplicate: true });
    expect(repo.add(toRecord(s)!)).toMatchObject({ duplicate: true });
    expect(repo.all()).toHaveLength(1);
    expect(repo.all()[0]).toMatchObject({ status: 'partial', activeSeconds: 60 });
  });

  it('repeated Finish clicks are ignored after the first', () => {
    const first = finishEarly(start(slow(), T0), T0 + 30 * S);
    const second = finishEarly(first, T0 + 31 * S);
    expect(second).toBe(first);
    expect(cancel(first, T0 + 32 * S)).toBe(first);
  });

  it('repeated Pause or Resume calls are no-ops', () => {
    const running = start(slow(), T0);
    const paused = pause(running, T0 + 5 * S);
    expect(pause(paused, T0 + 6 * S)).toBe(paused);
    const resumed = resume(paused, T0 + 7 * S);
    expect(resume(resumed, T0 + 8 * S)).toBe(resumed);
    expect(resume(running, T0 + 9 * S)).toBe(running);
    expect(start(running, T0 + 9 * S)).toBe(running);
  });

  it('a completed session cannot be resumed, paused or restarted', () => {
    const done = tick(start(slow(), T0), T0 + 300 * S);
    expect(done.status).toBe('completed');
    expect(resume(done, T0 + 301 * S)).toBe(done);
    expect(pause(done, T0 + 301 * S)).toBe(done);
    expect(start(done, T0 + 301 * S)).toBe(done);
    expect(finishEarly(done, T0 + 301 * S)).toBe(done);
  });

  it('restarting creates an independent session with a new id', () => {
    const first = start(slow(), T0);
    const restarted = start(createSession('respiration-lente', first.config, T0 + 10 * S), T0 + 10 * S);
    expect(restarted.id).not.toBe(first.id);
    expect(activeMsAt(restarted, T0 + 10 * S)).toBe(0);
    expect(phaseAt((restarted as Extract<Session, { family: 'timeboxed' }>).segments, 0).phase.key).toBe('inhale');
  });

  it('finishing exactly when the target is reached records a completed session (not partial)', () => {
    const s = finishEarly(start(slow(), T0), T0 + 300 * S);
    expect(s.status).toBe('completed');
    expect(toRecord(s)).toMatchObject({ status: 'completed', activeSeconds: 300 });
  });

  it('very short early finishes are not recorded', () => {
    const s = finishEarly(start(slow(), T0), T0 + 3 * S);
    expect(s.status).toBe('partial');
    expect(toRecord(s)).toBeNull();
  });
});

describe('timer accuracy', () => {
  it('active elapsed time starts at zero', () => {
    expect(activeMsAt(slow(), T0 + 50 * S)).toBe(0);
    expect(activeMsAt(start(slow(), T0), T0)).toBe(0);
  });

  it('increases while running and stops while paused', () => {
    let s = start(slow(), T0);
    expect(activeMsAt(s, T0 + 12_345)).toBe(12_345);
    s = pause(s, T0 + 20 * S);
    expect(activeMsAt(s, T0 + 20 * S)).toBe(20 * S);
    expect(activeMsAt(s, T0 + 500 * S)).toBe(20 * S);
  });

  it('30 s active + 10 s paused + 20 s active records 50 s, not 60 s', () => {
    let s = start(slow(), T0);
    s = pause(s, T0 + 30 * S);
    s = resume(s, T0 + 40 * S);
    expect(activeMsAt(s, T0 + 40 * S)).toBe(30 * S); // resume continues from previous active time
    s = finishEarly(s, T0 + 60 * S);
    const record = toRecord(s)!;
    expect(record.activeSeconds).toBe(50);
    expect(record.pausedSeconds).toBe(10);
    expect(Date.parse(record.endedAt) - Date.parse(record.startedAt)).toBe(60 * S);
  });

  it('a delayed timer callback does not drift elapsed time or phases', () => {
    const s = start(slow(), T0);
    // Ticks at irregular, late moments give the same result as a perfect clock.
    const late = [1, 7, 7, 19, 33, 34].reduce((acc, sec) => tick(acc, T0 + sec * S + 437), s);
    expect(activeMsAt(late, T0 + 34 * S + 437)).toBe(34_437);
    const info = phaseAt((late as Extract<Session, { family: 'timeboxed' }>).segments, 34_437);
    expect(info.cycleIndex).toBe(3);
    expect(info.phase.key).toBe('exhale');
    expect(info.phaseRemainingMs).toBe(6000 - 437);
  });

  it('completes at the configured active duration even if the tick is very late', () => {
    let s = start(slow(), T0);
    s = pause(s, T0 + 100 * S);
    s = resume(s, T0 + 160 * S);
    s = tick(s, T0 + 999 * S); // background tab: callback hours late
    expect(s.status).toBe('completed');
    expect(s.finalActiveMs).toBe(300 * S);
    expect(s.endedAt).toBe(T0 + 360 * S);
    expect(toRecord(s)).toMatchObject({ activeSeconds: 300, pausedSeconds: 60 });
  });

  it('phase calculations recover after delayed callbacks in step protocols', () => {
    let s: Session = start(createSession('soupir-physiologique', normalizeConfig('soupir-physiologique'), T0), T0);
    s = tick(s, T0 + 25_000); // jumps over two repetitions at once
    expect(s.status).toBe('running');
    if (s.family !== 'sequence') throw new Error();
    // Two full repetitions (2 × 10.5 s) + inhale1 (3 s) → now in the micro-inhale of rep 3.
    expect(s.outcomes).toEqual(['done', 'done', 'pending']);
    expect(s.stepStartedMs).toBe(24_000);
    expect(s.steps[s.stepIndex]).toMatchObject({ unit: 2, key: 'inhale2' });
  });

  it('finishing early records the correct duration', () => {
    let s = start(slow(), T0);
    s = pause(s, T0 + 61_900);
    s = finishEarly(s, T0 + 90 * S);
    expect(toRecord(s)).toMatchObject({ status: 'partial', activeSeconds: 61, pausedSeconds: 28 });
  });

  it('refresh recovery does not double-count elapsed time', () => {
    const running = start(slow(), T0);
    // Last checkpoint 40 s in; the page was closed and reopened 5 minutes later.
    const restored = recover(running, T0 + 40 * S, T0 + 340 * S);
    expect(restored.status).toBe('paused');
    expect(activeMsAt(restored, T0 + 340 * S)).toBe(40 * S);
    expect(pausedMsAt(restored, T0 + 340 * S)).toBe(300 * S);
    // Recovering twice gives the same result.
    expect(recover(restored, T0 + 340 * S, T0 + 400 * S)).toBe(restored);
    const resumed = resume(restored, T0 + 340 * S);
    expect(activeMsAt(resumed, T0 + 350 * S)).toBe(50 * S);
  });

  it('a recovered paused session keeps its state', () => {
    const paused = pause(start(slow(), T0), T0 + 20 * S);
    expect(recover(paused, T0 + 30 * S, T0 + 90 * S)).toBe(paused);
  });

  it('clock going backwards never produces negative time', () => {
    const s = start(slow(), T0);
    expect(activeMsAt(s, T0 - 5000)).toBe(0);
  });

  it('zero and very short durations do not loop forever', () => {
    const zero = createSession('respiration-lente', { ...normalizeConfig('respiration-lente'), durationSec: 0, inhaleSec: 0 }, T0);
    if (zero.family !== 'timeboxed') throw new Error();
    expect(zero.targetMs).toBeGreaterThan(0);
    expect(zero.segments[0]!.phases.every((p) => p.durationMs >= 1000)).toBe(true);
    const tiny = createSession('respiration-lente', { ...normalizeConfig('respiration-lente'), durationSec: 1 }, T0);
    if (tiny.family !== 'timeboxed') throw new Error();
    expect(tiny.targetMs).toBe(60_000); // custom durations are at least one minute
    const done = tick(start(tiny, T0), T0 + 60 * S);
    expect(done.status).toBe('completed');
    // A sequence with all-manual steps ticked far in the future stays put.
    const manual = start(createSession('ancrage-sensoriel', normalizeConfig('ancrage-sensoriel'), T0), T0);
    expect(tick(manual, T0 + 10 ** 9)).toBe(manual);
    expect(nextStep(manual, T0 + 1).status).toBe('running');
  });

  it('formats consistently (elapsed rounds down, remaining rounds up)', () => {
    expect(formatClock(59_999)).toBe('00:59');
    expect(formatRemaining(59_001)).toBe('01:00');
    expect(formatRemaining(0)).toBe('00:00');
    expect(phaseSeconds(3001)).toBe(4);
    expect(phaseSeconds(3000)).toBe(3);
    expect(formatDuration(50)).toBe('50 s');
    expect(formatDuration(300)).toBe('5 min');
    expect(formatDuration(330)).toBe('5 min 30');
    expect(formatDuration(3720)).toBe('1 h 02');
  });
});
