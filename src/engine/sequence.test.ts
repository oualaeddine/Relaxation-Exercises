import { describe, expect, it } from 'vitest';
import { normalizeConfig } from '../domain/config';
import { BODY_SCAN_ZONES, GROUNDING_STEPS, PMR_GROUPS, getExercise } from '../domain/exercises';
import type { ExerciseId } from '../domain/types';
import { HUM_EXHALE_MS, HUM_INHALE_MS, PMR_PRESETS, SIGH_STEPS_MS, buildSequencePlan, estimatePlanMs } from './plan';
import {
  activeMsAt,
  createSession,
  finishEarly,
  nextPrompt,
  nextStep,
  nextUnit,
  pause,
  prevPrompt,
  prevStep,
  prevUnit,
  promptIndexAt,
  replan,
  restartUnit,
  resume,
  sequenceProgress,
  setUnitExcluded,
  skipUnit,
  start,
  tick,
  toRecord,
  type Session,
  type SequenceSession,
} from './session';

const T0 = Date.UTC(2026, 9, 26, 8, 0, 0);

function seq(id: ExerciseId, config: Record<string, unknown> = {}): SequenceSession {
  const s = createSession(id, normalizeConfig(id, config), T0, `test-${id}`);
  if (s.family !== 'sequence') throw new Error('expected sequence');
  return s;
}

function asSeq(s: Session): SequenceSession {
  if (s.family !== 'sequence') throw new Error('expected sequence');
  return s;
}

const progress = (s: Session, now: number) => sequenceProgress(asSeq(s), now);

describe('humming exhalation (repetitions)', () => {
  it('builds 5 repetitions of inhale 3 s + hum 8 s by default', () => {
    const s = seq('expiration-fredonnement');
    expect(s.unitKeys).toHaveLength(5);
    expect(s.steps).toHaveLength(10);
    expect(s.steps.slice(0, 2)).toEqual([
      { unit: 0, key: 'inhale', durationMs: HUM_INHALE_MS },
      { unit: 0, key: 'hum', durationMs: HUM_EXHALE_MS },
    ]);
  });

  it('counts repetitions automatically and completes at the target', () => {
    let s: Session = start(seq('expiration-fredonnement'), T0);
    s = tick(s, T0 + 11_000);
    expect(progress(s, T0 + 11_000).unitsDone).toBe(1);
    expect(progress(s, T0 + 11_000).unit).toBe(1);
    s = tick(s, T0 + 54_999);
    expect(s.status).toBe('running');
    s = tick(s, T0 + 55_000);
    expect(s.status).toBe('completed');
    expect(s.finalActiveMs).toBe(55_000);
    expect(toRecord(s)).toMatchObject({ unitsTotal: 5, unitsCompleted: 5, unitsSkipped: 0, activeSeconds: 55 });
  });

  it('manual "Répétition terminée" and "Passer ce cycle" count separately', () => {
    let s: Session = start(seq('expiration-fredonnement', { autoPace: false }), T0);
    expect(asSeq(s).steps[0]).toEqual({ unit: 0, key: 'hum-free', durationMs: null });
    s = nextUnit(s, T0 + 9000);
    s = skipUnit(s, T0 + 10_000);
    s = nextUnit(s, T0 + 20_000);
    expect(progress(s, T0 + 20_000)).toMatchObject({ unit: 3, unitsDone: 2, unitsSkipped: 1 });
    s = nextUnit(s, T0 + 30_000);
    s = nextUnit(s, T0 + 40_000);
    expect(s.status).toBe('completed');
    expect(toRecord(s)).toMatchObject({ unitsCompleted: 4, unitsSkipped: 1, unitsTotal: 5, activeSeconds: 40 });
  });

  it('manual steps never auto-advance, however late the tick', () => {
    let s: Session = start(seq('expiration-fredonnement', { autoPace: false }), T0);
    s = tick(s, T0 + 3_600_000);
    expect(s.status).toBe('running');
    expect(progress(s, T0 + 3_600_000).unit).toBe(0);
  });

  it('early termination records a partial session', () => {
    let s: Session = start(seq('expiration-fredonnement'), T0);
    s = finishEarly(s, T0 + 25_000);
    expect(s.status).toBe('partial');
    expect(toRecord(s)).toMatchObject({ status: 'partial', unitsCompleted: 2, activeSeconds: 25 });
  });

  it('can change the number of repetitions mid-session (replan)', () => {
    let s: Session = start(seq('expiration-fredonnement'), T0);
    s = tick(s, T0 + 12_000);
    s = replan(s, normalizeConfig('expiration-fredonnement', { repetitions: 7 }), T0 + 12_000);
    expect(asSeq(s).unitKeys).toHaveLength(7);
    expect(progress(s, T0 + 12_000)).toMatchObject({ unit: 1, unitsDone: 1 });
  });

  it('switching pacing mode mid-repetition restarts the current repetition in the new mode', () => {
    let s: Session = start(seq('expiration-fredonnement'), T0);
    s = tick(s, T0 + 12_000); // repetition 2, inhale step
    s = replan(s, normalizeConfig('expiration-fredonnement', { autoPace: false }), T0 + 12_000);
    expect(progress(s, T0 + 12_000)).toMatchObject({ unit: 1, unitsDone: 1, step: { key: 'hum-free', durationMs: null } });
    expect(asSeq(s).stepStartedMs).toBe(12_000);
    expect(asSeq(s).config.autoPace).toBe(false);
  });

  it('refuses a replan that removes the current repetition', () => {
    let s: Session = start(seq('expiration-fredonnement', { repetitions: 7 }), T0);
    s = tick(s, T0 + 6 * 11_000 + 1000); // repetition 7
    expect(replan(s, normalizeConfig('expiration-fredonnement', { repetitions: 5 }), T0 + 67_000)).toBe(s);
  });
});

describe('gentle physiological sigh', () => {
  it('uses inhale 3 s + micro-inhale 1.5 s + exhale 6 s per repetition', () => {
    const s = seq('soupir-physiologique');
    expect(s.unitKeys).toHaveLength(3);
    expect(s.steps.filter((st) => st.unit === 0).map((st) => [st.key, st.durationMs])).toEqual([
      ['inhale1', SIGH_STEPS_MS.inhale1],
      ['inhale2', SIGH_STEPS_MS.inhale2],
      ['exhale', SIGH_STEPS_MS.exhale],
    ]);
  });

  it('can disable the second inhalation', () => {
    const s = seq('soupir-physiologique', { secondInhale: false });
    expect(s.steps.filter((st) => st.unit === 0).map((st) => st.key)).toEqual(['inhale1', 'exhale']);
  });

  it('completes exactly after the target number of repetitions', () => {
    let s: Session = start(seq('soupir-physiologique', { repetitions: 2 }), T0);
    s = tick(s, T0 + 20_999);
    expect(s.status).toBe('running');
    s = tick(s, T0 + 21_000);
    expect(s.status).toBe('completed');
    expect(s.finalActiveMs).toBe(21_000);
  });

  it('manual pacing advances step by step', () => {
    let s: Session = start(seq('soupir-physiologique', { autoPace: false, repetitions: 1 }), T0);
    expect(progress(s, T0).step.key).toBe('inhale1');
    s = nextStep(s, T0 + 2000);
    expect(progress(s, T0 + 2000).step.key).toBe('inhale2');
    s = nextStep(s, T0 + 3000);
    expect(progress(s, T0 + 3000)).toMatchObject({ isLastStep: true });
    s = nextStep(s, T0 + 9000);
    expect(s.status).toBe('completed');
  });

  it('skipped repetitions are reported', () => {
    let s: Session = start(seq('soupir-physiologique'), T0);
    s = skipUnit(s, T0 + 1000);
    s = tick(s, T0 + 1000 + 21_000);
    expect(s.status).toBe('completed');
    expect(toRecord(s)).toMatchObject({ unitsCompleted: 2, unitsSkipped: 1 });
  });
});

describe('alternate-nostril breathing', () => {
  it('derives cycles from the duration (3 min → 9 cycles of 20 s)', () => {
    const s = seq('respiration-alternee');
    expect(s.unitKeys).toHaveLength(9);
    expect(s.steps).toHaveLength(36);
    expect(estimatePlanMs(buildSequencePlan('respiration-alternee', s.config))).toBe(180_000);
  });

  it('starts with an inhalation through the left nostril', () => {
    const s = start(seq('respiration-alternee'), T0);
    expect(progress(s, T0).step.key).toBe('in-gauche');
  });

  it('next and previous stay within range', () => {
    let s: Session = start(seq('respiration-alternee', { autoPace: false, durationSec: 120 }), T0);
    s = prevStep(s, T0 + 100);
    expect(progress(s, T0 + 100).stepIndex).toBe(0);
    s = nextStep(s, T0 + 200);
    s = nextStep(s, T0 + 300);
    expect(progress(s, T0 + 300).step.key).toBe('in-droite');
    s = prevStep(s, T0 + 400);
    expect(progress(s, T0 + 400).step.key).toBe('out-droite');
  });

  it('progress indicator is accurate and backward navigation does not double count', () => {
    let s: Session = start(seq('respiration-alternee', { autoPace: false, durationSec: 120 }), T0);
    for (let i = 0; i < 4; i += 1) s = nextStep(s, T0 + i * 1000);
    expect(progress(s, T0 + 5000)).toMatchObject({ unit: 1, unitsDone: 1, stepInUnit: 0, stepsInUnit: 4 });
    s = prevStep(s, T0 + 6000); // back into cycle 1
    expect(progress(s, T0 + 6000)).toMatchObject({ unit: 0, unitsDone: 1 });
    s = nextStep(s, T0 + 7000); // finish cycle 1 again
    expect(progress(s, T0 + 7000)).toMatchObject({ unit: 1, unitsDone: 1 });
  });
});

describe('progressive muscle relaxation', () => {
  it('builds 7 groups with tension 5 s / release 10 s rounds and an integration pause', () => {
    const s = seq('relaxation-musculaire');
    expect(s.unitKeys).toEqual(PMR_GROUPS.map((g) => g.key));
    const group = s.steps.filter((st) => st.unit === 0);
    expect(group.map((st) => st.key)).toEqual(['tension-1', 'release-1', 'tension-2', 'release-2', 'tension-3', 'release-3', 'integration']);
    expect(group[0]!.durationMs).toBe(5000);
    expect(group[1]!.durationMs).toBe(10_000);
    expect(estimatePlanMs(buildSequencePlan('relaxation-musculaire', s.config))).toBe(7 * (3 * 15_000 + PMR_PRESETS.standard.integrationMs));
  });

  it('changes muscle-group instructions as time passes', () => {
    let s: Session = start(seq('relaxation-musculaire', { pmrPreset: 'court' }), T0);
    expect(progress(s, T0)).toMatchObject({ unit: 0, step: { key: 'tension-1' } });
    s = tick(s, T0 + 5000);
    expect(progress(s, T0 + 5000).step.key).toBe('release-1');
    s = tick(s, T0 + 40_000);
    expect(progress(s, T0 + 40_000)).toMatchObject({ unit: 1, unitsDone: 1, step: { key: 'tension-1' } });
  });

  it('supports skipping an uncomfortable muscle group', () => {
    let s: Session = start(seq('relaxation-musculaire', { pmrPreset: 'court' }), T0);
    s = skipUnit(s, T0 + 2000);
    expect(progress(s, T0 + 2000)).toMatchObject({ unit: 1, unitsSkipped: 1, unitsDone: 0 });
  });

  it('excluded groups are skipped automatically, before or during the session', () => {
    let s: Session = start(seq('relaxation-musculaire', { pmrPreset: 'court', excludedUnits: ['mains'] }), T0);
    expect(progress(s, T0).unit).toBe(1);
    s = setUnitExcluded(s, 2, true, T0 + 1000);
    s = tick(s, T0 + 40_000);
    expect(progress(s, T0 + 40_000)).toMatchObject({ unit: 3, unitsSkipped: 2, unitsDone: 1 });
    // The current or past group cannot be excluded.
    expect(setUnitExcluded(s, 3, true, T0 + 40_000)).toBe(s);
  });

  it('"Répéter" restarts the current group', () => {
    let s: Session = start(seq('relaxation-musculaire', { pmrPreset: 'court' }), T0);
    s = tick(s, T0 + 7000);
    s = restartUnit(s, T0 + 7000);
    expect(progress(s, T0 + 7000)).toMatchObject({ unit: 0, step: { key: 'tension-1' }, stepRemainingMs: 5000 });
  });

  it('pause/resume keeps the group timing exact', () => {
    let s: Session = start(seq('relaxation-musculaire', { pmrPreset: 'court' }), T0);
    s = pause(s, T0 + 3000);
    s = resume(s, T0 + 60_000);
    expect(progress(s, T0 + 60_000)).toMatchObject({ step: { key: 'tension-1' }, stepRemainingMs: 2000 });
  });
});

describe('body scan', () => {
  it('splits the duration evenly across the 8 zones', () => {
    const s = seq('scan-corporel', { durationSec: 300 });
    expect(s.unitKeys).toEqual(BODY_SCAN_ZONES.map((z) => z.key));
    expect(s.steps.every((st) => st.durationMs === 37_500)).toBe(true);
  });

  it('auto-advances zones and completes at the configured duration', () => {
    let s: Session = start(seq('scan-corporel', { durationSec: 180 }), T0);
    s = tick(s, T0 + 22_500);
    expect(progress(s, T0 + 22_500).unit).toBe(1);
    s = tick(s, T0 + 180_000);
    expect(s.status).toBe('completed');
    expect(toRecord(s)).toMatchObject({ unitsCompleted: 8, activeSeconds: 180 });
  });

  it('previous / next zone stay within range', () => {
    let s: Session = start(seq('scan-corporel'), T0);
    s = prevUnit(s, T0 + 1000);
    expect(progress(s, T0 + 1000).unit).toBe(0);
    s = nextUnit(s, T0 + 2000);
    s = nextUnit(s, T0 + 3000);
    s = prevUnit(s, T0 + 4000);
    expect(progress(s, T0 + 4000)).toMatchObject({ unit: 1, unitsDone: 2 });
  });
});

describe('5-4-3-2-1 grounding', () => {
  it('starts on the "5 things you see" step with no countdown', () => {
    const s = start(seq('ancrage-sensoriel'), T0);
    const p = progress(s, T0);
    expect(p.unit).toBe(0);
    expect(p.stepRemainingMs).toBeNull();
    expect(GROUNDING_STEPS[p.unit]!.count).toBe(5);
  });

  it('progresses 5 → 4 → 3 → 2 → 1 and completes on the last step', () => {
    let s: Session = start(seq('ancrage-sensoriel'), T0);
    const counts: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      counts.push(GROUNDING_STEPS[progress(s, T0 + i * 10_000).unit]!.count);
      s = nextStep(s, T0 + (i + 1) * 10_000);
    }
    expect(counts).toEqual([5, 4, 3, 2, 1]);
    expect(s.status).toBe('completed');
    expect(toRecord(s)).toMatchObject({ unitsCompleted: 5, unitsTotal: 5, activeSeconds: 50 });
  });

  it('a completed exercise cannot advance to a nonexistent step', () => {
    let s: Session = start(seq('ancrage-sensoriel'), T0);
    for (let i = 0; i < 5; i += 1) s = nextStep(s, T0 + i);
    const done = s;
    expect(nextStep(done, T0 + 100)).toBe(done);
    expect(prevStep(done, T0 + 100)).toBe(done);
    expect(asSeq(done).stepIndex).toBe(4);
  });

  it('skipping a step without judgement counts as skipped', () => {
    let s: Session = start(seq('ancrage-sensoriel'), T0);
    s = skipUnit(s, T0 + 1000);
    expect(progress(s, T0 + 1000)).toMatchObject({ unit: 1, unitsSkipped: 1 });
  });

  it('backward navigation keeps counters consistent', () => {
    let s: Session = start(seq('ancrage-sensoriel'), T0);
    s = nextStep(s, T0 + 1000);
    s = nextStep(s, T0 + 2000);
    s = prevStep(s, T0 + 3000);
    s = prevStep(s, T0 + 4000);
    s = prevStep(s, T0 + 5000);
    expect(progress(s, T0 + 5000)).toMatchObject({ unit: 0, unitsDone: 2 });
    s = nextStep(s, T0 + 6000);
    s = nextStep(s, T0 + 7000);
    expect(progress(s, T0 + 7000)).toMatchObject({ unit: 2, unitsDone: 2 });
  });
});

describe('mindful walking (prompts)', () => {
  it('never imposes a breathing cadence', () => {
    const s = createSession('marche-attentive', normalizeConfig('marche-attentive'), T0);
    expect(s.family).toBe('timeboxed');
    if (s.family !== 'timeboxed') return;
    expect(s.segments).toEqual([]);
    expect(getExercise('marche-attentive').protocol).toBe('prompts');
  });

  it('rotates prompts every 90 s and supports previous / next', () => {
    let s: Session = start(createSession('marche-attentive', normalizeConfig('marche-attentive'), T0), T0);
    if (s.family !== 'timeboxed') throw new Error();
    expect(promptIndexAt(s, 0)).toBe(0);
    expect(promptIndexAt(s, 90_000)).toBe(1);
    expect(promptIndexAt(s, 5 * 90_000)).toBe(0);
    s = nextPrompt(s, T0 + 10_000);
    if (s.family !== 'timeboxed') throw new Error();
    expect(promptIndexAt(s, activeMsAt(s, T0 + 10_000))).toBe(1);
    s = prevPrompt(s, T0 + 11_000);
    s = prevPrompt(s, T0 + 12_000);
    if (s.family !== 'timeboxed') throw new Error();
    expect(promptIndexAt(s, activeMsAt(s, T0 + 12_000))).toBe(4);
  });

  it('completes at the walking duration regardless of prompt navigation', () => {
    let s: Session = start(createSession('marche-attentive', normalizeConfig('marche-attentive', { durationSec: 300 }), T0), T0);
    s = nextPrompt(s, T0 + 1000);
    s = tick(s, T0 + 300_000);
    expect(s.status).toBe('completed');
    expect(s.finalActiveMs).toBe(300_000);
  });
});
