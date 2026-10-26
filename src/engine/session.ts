/**
 * Calme session engine — a pure, clock-injected state machine shared by all ten exercises.
 *
 * Timing model
 * ------------
 * - Every action receives `now` (epoch milliseconds). Nothing reads the system clock here.
 * - Active time is `accumulatedMs + (now - runningSince)` while running, frozen otherwise.
 *   Paused time is tracked separately and is never added to active time.
 * - Phases, steps and completion are *derived* from active time, never counted by ticks, so a
 *   late or skipped timer callback cannot introduce drift: the next tick simply catches up.
 * - Internal precision is milliseconds; records round down to whole seconds.
 *
 * Every action first brings the session up to date at `now` (auto-advance / completion),
 * then applies its transition. Invalid transitions return the *same* object (no-op).
 */
import { normalizeConfig } from '../domain/config';
import { getExercise } from '../domain/exercises';
import type { ExerciseConfig, ExerciseId, Feeling, SessionRecord } from '../domain/types';
import {
  WALK_PROMPT_ROTATION_MS,
  buildSequencePlan,
  cycleLengthMs,
  normalizePhases,
  normalizeTargetMs,
  pacedPhases,
  type PhaseSpec,
  type PlanStep,
} from './plan';

export type SessionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'partial' | 'cancelled';
export type UnitOutcome = 'pending' | 'done' | 'skipped';

export interface CadenceSegment {
  /** Active time (ms) at which this cadence starts. */
  startMs: number;
  /** Number of cycles completed before this segment started. */
  cycleOffset: number;
  phases: PhaseSpec[];
}

interface SessionBase {
  version: 1;
  id: string;
  exerciseId: ExerciseId;
  config: ExerciseConfig;
  status: SessionStatus;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  accumulatedMs: number;
  runningSince: number | null;
  pausedMs: number;
  pausedSince: number | null;
  /** Active time frozen when the session ends. */
  finalActiveMs: number | null;
}

export interface TimeboxedSession extends SessionBase {
  family: 'timeboxed';
  targetMs: number;
  /** Breathing cadence (empty for free-breathing prompts). */
  segments: CadenceSegment[];
  prompts: { count: number; rotationMs: number; anchorMs: number; anchorIndex: number } | null;
}

export interface SequenceSession extends SessionBase {
  family: 'sequence';
  steps: PlanStep[];
  unitKeys: string[];
  stepIndex: number;
  /** Active time (ms) at which the current step started. */
  stepStartedMs: number;
  outcomes: UnitOutcome[];
  excluded: boolean[];
}

export type Session = TimeboxedSession | SequenceSession;

export const ENDED_STATUSES: readonly SessionStatus[] = ['completed', 'partial', 'cancelled'];
export const MIN_PARTIAL_RECORD_SECONDS = 5;

export function isEnded(session: Session): boolean {
  return ENDED_STATUSES.includes(session.status);
}

export function isLive(session: Session): boolean {
  return session.status === 'running' || session.status === 'paused';
}

/* ------------------------------------------------------------------------------------------ */
/* Creation                                                                                   */
/* ------------------------------------------------------------------------------------------ */

export function createSession(
  exerciseId: ExerciseId,
  rawConfig: ExerciseConfig,
  now: number,
  id: string = createId(),
): Session {
  const exercise = getExercise(exerciseId);
  // Defensive: never trust the caller's configuration (zero/negative durations, NaN…).
  const config = normalizeConfig(exercise, rawConfig);
  const base: SessionBase = {
    version: 1,
    id,
    exerciseId,
    config,
    status: 'idle',
    createdAt: now,
    startedAt: null,
    endedAt: null,
    accumulatedMs: 0,
    runningSince: null,
    pausedMs: 0,
    pausedSince: null,
    finalActiveMs: null,
  };
  if (exercise.protocol === 'paced') {
    return {
      ...base,
      family: 'timeboxed',
      targetMs: normalizeTargetMs(config.durationSec * 1000),
      segments: [{ startMs: 0, cycleOffset: 0, phases: pacedPhases(exerciseId, config) }],
      prompts: null,
    };
  }
  if (exercise.protocol === 'prompts') {
    return {
      ...base,
      family: 'timeboxed',
      targetMs: normalizeTargetMs(config.durationSec * 1000),
      segments: [],
      prompts: {
        count: exercise.units?.length ?? 1,
        rotationMs: WALK_PROMPT_ROTATION_MS,
        anchorMs: 0,
        anchorIndex: 0,
      },
    };
  }
  const plan = buildSequencePlan(exerciseId, config);
  const excluded = plan.unitKeys.map((key) => config.excludedUnits.includes(key));
  return {
    ...base,
    family: 'sequence',
    steps: plan.steps,
    unitKeys: plan.unitKeys,
    stepIndex: 0,
    stepStartedMs: 0,
    outcomes: plan.unitKeys.map((_, u) => (excluded[u] ? 'skipped' : 'pending')),
    excluded,
  };
}

export function createId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------------------------------ */
/* Time accounting                                                                            */
/* ------------------------------------------------------------------------------------------ */

/** Active (non-paused) time in ms at `now`. Never negative, never includes paused time. */
export function activeMsAt(session: Session, now: number): number {
  if (session.finalActiveMs !== null) return session.finalActiveMs;
  const running = session.runningSince === null ? 0 : Math.max(0, now - session.runningSince);
  return session.accumulatedMs + running;
}

export function pausedMsAt(session: Session, now: number): number {
  const current = session.pausedSince === null ? 0 : Math.max(0, now - session.pausedSince);
  return session.pausedMs + current;
}

/** Wall-clock time at which the given active time was (or will be) reached in the current run. */
function wallTimeForActive(session: Session, activeMs: number, now: number): number {
  if (session.runningSince === null) return now;
  return Math.min(now, session.runningSince + (activeMs - session.accumulatedMs));
}

function end(session: Session, status: SessionStatus, finalActiveMs: number, endedAt: number): Session {
  return {
    ...session,
    status,
    finalActiveMs,
    accumulatedMs: finalActiveMs,
    runningSince: null,
    pausedMs: pausedMsAt(session, endedAt),
    pausedSince: null,
    endedAt,
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Cadence (paced breathing)                                                                  */
/* ------------------------------------------------------------------------------------------ */

export interface PhaseInfo {
  phase: PhaseSpec;
  phaseIndex: number;
  phaseCount: number;
  phaseElapsedMs: number;
  phaseRemainingMs: number;
  /** Zero-based index of the current cycle == number of fully completed cycles. */
  cycleIndex: number;
  cycleElapsedMs: number;
  cycleMs: number;
  segment: CadenceSegment;
}

/** Pure phase lookup — the single timing source for labels, countdowns and animation. */
export function phaseAt(segments: readonly CadenceSegment[], activeMs: number): PhaseInfo {
  if (segments.length === 0) throw new Error('Aucune cadence');
  const t = Math.max(0, activeMs);
  let segment = segments[0]!;
  for (const s of segments) if (s.startMs <= t) segment = s;
  const cycleMs = cycleLengthMs(segment.phases);
  const local = t - segment.startMs;
  const cyclesInSegment = Math.floor(local / cycleMs);
  const cycleElapsedMs = local - cyclesInSegment * cycleMs;
  let offset = 0;
  let phaseIndex = 0;
  for (let i = 0; i < segment.phases.length; i += 1) {
    const d = segment.phases[i]!.durationMs;
    if (cycleElapsedMs < offset + d) {
      phaseIndex = i;
      break;
    }
    offset += d;
  }
  const phase = segment.phases[phaseIndex]!;
  const phaseElapsedMs = cycleElapsedMs - offset;
  return {
    phase,
    phaseIndex,
    phaseCount: segment.phases.length,
    phaseElapsedMs,
    phaseRemainingMs: phase.durationMs - phaseElapsedMs,
    cycleIndex: segment.cycleOffset + cyclesInSegment,
    cycleElapsedMs,
    cycleMs,
    segment,
  };
}

/** Number of cycles started before the target is reached (the "Cycle x / N" total). */
export function plannedCycles(session: TimeboxedSession): number {
  if (session.segments.length === 0) return 0;
  return phaseAt(session.segments, Math.max(0, session.targetMs - 1)).cycleIndex + 1;
}

/**
 * Changes the breathing cadence.
 * - While paused (or idle) the new cadence starts immediately with a fresh inhalation.
 * - While running it starts at the next cycle boundary, so the current breath is never cut.
 */
export function applyCadence(session: Session, rawPhases: readonly PhaseSpec[], now: number): Session {
  const s = sync(session, now);
  if (s.family !== 'timeboxed' || s.segments.length === 0 || isEnded(s)) return s;
  const phases = normalizePhases(rawPhases);
  if (!phases) return s;
  const active = activeMsAt(s, now);
  const info = phaseAt(s.segments, active);
  const kept = s.segments.filter((seg) => seg.startMs <= active);
  let segment: CadenceSegment;
  if (s.status === 'running') {
    const startMs = info.cycleElapsedMs === 0 ? active : active - info.cycleElapsedMs + info.cycleMs;
    segment = { startMs, cycleOffset: info.cycleIndex + (info.cycleElapsedMs === 0 ? 0 : 1), phases };
  } else {
    segment = { startMs: active, cycleOffset: info.cycleIndex + (info.cycleElapsedMs === 0 ? 0 : 1), phases };
  }
  const segments = kept.filter((seg) => seg.startMs < segment.startMs);
  segments.push(segment);
  return { ...s, segments };
}

/** Changes the target duration of a time-boxed session. It must stay after the current time. */
export function setTarget(session: Session, targetMs: number, now: number): Session {
  const s = sync(session, now);
  if (s.family !== 'timeboxed' || isEnded(s)) return s;
  const target = normalizeTargetMs(targetMs);
  if (target <= activeMsAt(s, now) + 1000) return s;
  return { ...s, targetMs: target };
}

/* ------------------------------------------------------------------------------------------ */
/* Lifecycle                                                                                  */
/* ------------------------------------------------------------------------------------------ */

export function start(session: Session, now: number): Session {
  if (session.status !== 'idle') return session;
  let s: Session = { ...session, status: 'running', startedAt: now, runningSince: now };
  if (s.family === 'sequence') {
    const first = firstIncludedStep(s, 0, 1);
    if (first === null) return end(s, 'completed', 0, now);
    s = { ...s, stepIndex: first, stepStartedMs: 0 };
  }
  return s;
}

export function pause(session: Session, now: number): Session {
  const s = sync(session, now);
  if (s.status !== 'running') return s;
  return {
    ...s,
    status: 'paused',
    accumulatedMs: activeMsAt(s, now),
    runningSince: null,
    pausedSince: now,
  };
}

export function resume(session: Session, now: number): Session {
  if (session.status !== 'paused') return session;
  return {
    ...session,
    status: 'running',
    runningSince: now,
    pausedMs: pausedMsAt(session, now),
    pausedSince: null,
  };
}

/** Brings a running session up to date: auto-advances steps and completes it when due. */
export function tick(session: Session, now: number): Session {
  return sync(session, now);
}

/** Ends the session before its target. Records it as `partial` (or `completed` if already due). */
export function finishEarly(session: Session, now: number): Session {
  const s = sync(session, now);
  if (!isLive(s)) return s;
  const active = activeMsAt(s, now);
  return end(s, 'partial', active, now);
}

/** Abandons the session. Cancelled sessions are never recorded. */
export function cancel(session: Session, now: number): Session {
  if (isEnded(session)) return session;
  const s = sync(session, now);
  if (isEnded(s)) return s;
  return end(s, 'cancelled', activeMsAt(s, now), now);
}

/* ------------------------------------------------------------------------------------------ */
/* Sequence navigation                                                                        */
/* ------------------------------------------------------------------------------------------ */

function sync(session: Session, now: number): Session {
  if (session.status !== 'running') return session;
  const active = activeMsAt(session, now);
  if (session.family === 'timeboxed') {
    if (active >= session.targetMs) {
      return end(session, 'completed', session.targetMs, wallTimeForActive(session, session.targetMs, now));
    }
    return session;
  }
  return advanceAuto(session, active, now);
}

function firstStepOfUnit(s: SequenceSession, unit: number): number | null {
  const index = s.steps.findIndex((st) => st.unit === unit);
  return index === -1 ? null : index;
}

/** First step at or after/before `from` (direction ±1) whose unit is not excluded. */
function firstIncludedStep(s: SequenceSession, from: number, direction: 1 | -1): number | null {
  for (let i = from; i >= 0 && i < s.steps.length; i += direction) {
    if (!s.excluded[s.steps[i]!.unit]) return i;
  }
  return null;
}

function markUnit(outcomes: UnitOutcome[], unit: number, outcome: UnitOutcome): UnitOutcome[] {
  const copy = outcomes.slice();
  copy[unit] = outcome;
  return copy;
}

function advanceAuto(s: SequenceSession, active: number, now: number): Session {
  let index = s.stepIndex;
  let startedMs = s.stepStartedMs;
  let outcomes = s.outcomes;
  let changed = false;
  // Each iteration moves forward by at least one step, so the loop always terminates.
  while (index < s.steps.length) {
    const step = s.steps[index]!;
    if (s.excluded[step.unit]) {
      outcomes = markUnit(outcomes, step.unit, 'skipped');
      index += 1;
      changed = true;
      continue;
    }
    if (step.durationMs === null || step.durationMs <= 0) break;
    if (active - startedMs < step.durationMs) break;
    startedMs += step.durationMs;
    const next = s.steps[index + 1];
    if (!next || next.unit !== step.unit) outcomes = markUnit(outcomes, step.unit, 'done');
    index += 1;
    changed = true;
  }
  if (!changed) return s;
  const updated: SequenceSession = { ...s, stepIndex: Math.min(index, s.steps.length - 1), stepStartedMs: startedMs, outcomes };
  if (index >= s.steps.length) {
    return end(updated, 'completed', startedMs, wallTimeForActive(s, startedMs, now));
  }
  return updated;
}

function moveTo(s: SequenceSession, target: number | null, active: number, now: number, outcomes: UnitOutcome[]): Session {
  if (target === null) return end({ ...s, outcomes }, 'completed', active, now);
  return { ...s, stepIndex: target, stepStartedMs: active, outcomes };
}

function navigable(session: Session, now: number): { s: SequenceSession; active: number } | null {
  const s = sync(session, now);
  if (s.family !== 'sequence' || !isLive(s)) return null;
  return { s, active: activeMsAt(s, now) };
}

/** Advances by one step. Finishing the last step of a unit marks it done; past the end completes. */
export function nextStep(session: Session, now: number): Session {
  const nav = navigable(session, now);
  if (!nav) return sync(session, now);
  const { s, active } = nav;
  const step = s.steps[s.stepIndex]!;
  const following = s.steps[s.stepIndex + 1];
  const outcomes = !following || following.unit !== step.unit ? markUnit(s.outcomes, step.unit, 'done') : s.outcomes;
  return moveTo(s, firstIncludedStep(s, s.stepIndex + 1, 1), active, now, outcomes);
}

/** Goes back one step (never before the first included step). Outcomes are left untouched. */
export function prevStep(session: Session, now: number): Session {
  const nav = navigable(session, now);
  if (!nav) return sync(session, now);
  const { s, active } = nav;
  const target = firstIncludedStep(s, s.stepIndex - 1, -1);
  if (target === null) return s;
  return { ...s, stepIndex: target, stepStartedMs: active };
}

function leaveUnit(session: Session, now: number, outcome: 'done' | 'skipped'): Session {
  const nav = navigable(session, now);
  if (!nav) return sync(session, now);
  const { s, active } = nav;
  const unit = s.steps[s.stepIndex]!.unit;
  const outcomes = markUnit(s.outcomes, unit, outcome);
  const nextUnitStart = s.steps.findIndex((st) => st.unit > unit);
  const target = nextUnitStart === -1 ? null : firstIncludedStep(s, nextUnitStart, 1);
  return moveTo(s, target, active, now, outcomes);
}

/** Marks the current unit (repetition, group, zone…) done and moves to the next one. */
export function nextUnit(session: Session, now: number): Session {
  return leaveUnit(session, now, 'done');
}

/** Skips the current unit (e.g. an uncomfortable muscle group) and moves to the next one. */
export function skipUnit(session: Session, now: number): Session {
  return leaveUnit(session, now, 'skipped');
}

/** Moves to the first step of the previous included unit. */
export function prevUnit(session: Session, now: number): Session {
  const nav = navigable(session, now);
  if (!nav) return sync(session, now);
  const { s, active } = nav;
  const unit = s.steps[s.stepIndex]!.unit;
  for (let u = unit - 1; u >= 0; u -= 1) {
    if (s.excluded[u]) continue;
    const index = firstStepOfUnit(s, u);
    if (index !== null) return { ...s, stepIndex: index, stepStartedMs: active };
  }
  return s;
}

/** Restarts the current unit from its first step (e.g. "Répéter" a muscle group). */
export function restartUnit(session: Session, now: number): Session {
  const nav = navigable(session, now);
  if (!nav) return sync(session, now);
  const { s, active } = nav;
  const index = firstStepOfUnit(s, s.steps[s.stepIndex]!.unit);
  if (index === null) return s;
  return { ...s, stepIndex: index, stepStartedMs: active };
}

/** Includes or excludes a future unit (a muscle group can be excluded during the session). */
export function setUnitExcluded(session: Session, unit: number, excluded: boolean, now: number): Session {
  const s = sync(session, now);
  if (s.family !== 'sequence' || isEnded(s) || unit < 0 || unit >= s.unitKeys.length) return s;
  const current = s.steps[s.stepIndex]!.unit;
  if (s.status !== 'idle' && unit <= current) return s;
  const nextExcluded = s.excluded.slice();
  nextExcluded[unit] = excluded;
  if (nextExcluded.every(Boolean)) return s;
  const outcomes = markUnit(s.outcomes, unit, excluded ? 'skipped' : 'pending');
  const unitKeys = s.unitKeys;
  const config = {
    ...s.config,
    excludedUnits: unitKeys.filter((_, u) => nextExcluded[u]),
  };
  return { ...s, excluded: nextExcluded, outcomes, config };
}

/**
 * Replaces the plan (e.g. toggling automatic pacing, changing the number of repetitions or the
 * scan duration). Completed units keep their outcome. If every step up to the current one is
 * unchanged, the position is kept; otherwise the current unit restarts from its first step in the
 * new plan. Returns the session unchanged if the new plan has no room for the current unit.
 */
export function replan(session: Session, config: ExerciseConfig, now: number): Session {
  const s = sync(session, now);
  if (s.family !== 'sequence' || isEnded(s)) return s;
  const plan = buildSequencePlan(s.exerciseId, normalizeConfig(s.exerciseId, config));
  const current = s.steps[s.stepIndex]!;
  if (current.unit >= plan.unitKeys.length) return s;
  const outcomes: UnitOutcome[] = plan.unitKeys.map((_, u) => s.outcomes[u] ?? 'pending');
  const excluded = plan.unitKeys.map((_, u) => s.excluded[u] ?? false);
  const samePrefix =
    plan.steps.length > s.stepIndex &&
    s.steps.slice(0, s.stepIndex + 1).every((a, i) => a.key === plan.steps[i]!.key && a.unit === plan.steps[i]!.unit);
  const base = { ...s, config: normalizeConfig(s.exerciseId, config), steps: plan.steps, unitKeys: plan.unitKeys, outcomes, excluded };
  if (samePrefix) return base;
  const first = plan.steps.findIndex((st) => st.unit === current.unit);
  return { ...base, stepIndex: first, stepStartedMs: activeMsAt(s, now) };
}

/* ------------------------------------------------------------------------------------------ */
/* Prompts (mindful walking)                                                                  */
/* ------------------------------------------------------------------------------------------ */

export function promptIndexAt(session: TimeboxedSession, activeMs: number): number {
  const p = session.prompts;
  if (!p || p.count === 0) return 0;
  const steps = Math.floor(Math.max(0, activeMs - p.anchorMs) / p.rotationMs);
  return (((p.anchorIndex + steps) % p.count) + p.count) % p.count;
}

function shiftPrompt(session: Session, now: number, delta: 1 | -1): Session {
  const s = sync(session, now);
  if (s.family !== 'timeboxed' || !s.prompts || !isLive(s)) return s;
  const active = activeMsAt(s, now);
  const index = promptIndexAt(s, active);
  const count = s.prompts.count;
  return { ...s, prompts: { ...s.prompts, anchorMs: active, anchorIndex: (index + delta + count) % count } };
}

export function nextPrompt(session: Session, now: number): Session {
  return shiftPrompt(session, now, 1);
}

export function prevPrompt(session: Session, now: number): Session {
  return shiftPrompt(session, now, -1);
}

/* ------------------------------------------------------------------------------------------ */
/* Views                                                                                      */
/* ------------------------------------------------------------------------------------------ */

export interface SequenceProgress {
  step: PlanStep;
  stepIndex: number;
  stepElapsedMs: number;
  stepRemainingMs: number | null;
  unit: number;
  unitCount: number;
  unitsDone: number;
  unitsSkipped: number;
  /** Position of the current step within its unit (0-based) and the unit's step count. */
  stepInUnit: number;
  stepsInUnit: number;
  isLastStep: boolean;
  isLastUnit: boolean;
}

export function sequenceProgress(session: SequenceSession, now: number): SequenceProgress {
  const s = sync(session, now) as SequenceSession;
  const active = activeMsAt(s, now);
  const step = s.steps[s.stepIndex]!;
  const unitSteps = s.steps.filter((st) => st.unit === step.unit);
  const stepInUnit = s.stepIndex - s.steps.indexOf(unitSteps[0]!);
  const elapsed = Math.max(0, active - s.stepStartedMs);
  const lastIncluded = firstIncludedStep(s, s.steps.length - 1, -1);
  const lastUnit = lastIncluded === null ? step.unit : s.steps[lastIncluded]!.unit;
  return {
    step,
    stepIndex: s.stepIndex,
    stepElapsedMs: elapsed,
    stepRemainingMs: step.durationMs === null ? null : Math.max(0, step.durationMs - elapsed),
    unit: step.unit,
    unitCount: s.unitKeys.length,
    unitsDone: s.outcomes.filter((o) => o === 'done').length,
    unitsSkipped: s.outcomes.filter((o) => o === 'skipped').length,
    stepInUnit,
    stepsInUnit: unitSteps.length,
    isLastStep: s.stepIndex === lastIncluded,
    isLastUnit: step.unit === lastUnit,
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Records                                                                                    */
/* ------------------------------------------------------------------------------------------ */

export function cyclesCompleted(session: Session): number | null {
  if (session.family !== 'timeboxed' || session.segments.length === 0) return null;
  const active = session.finalActiveMs ?? session.accumulatedMs;
  return phaseAt(session.segments, active).cycleIndex;
}

/**
 * Converts an ended session into a history record. Returns `null` for cancelled sessions, for
 * sessions that never started, and for early finishes shorter than MIN_PARTIAL_RECORD_SECONDS.
 */
export function toRecord(session: Session, feeling: Feeling | null = null): SessionRecord | null {
  if (session.status !== 'completed' && session.status !== 'partial') return null;
  if (session.startedAt === null || session.endedAt === null || session.finalActiveMs === null) return null;
  const activeSeconds = Math.floor(session.finalActiveMs / 1000);
  if (session.status === 'partial' && activeSeconds < MIN_PARTIAL_RECORD_SECONDS) return null;
  const isSequence = session.family === 'sequence';
  return {
    id: session.id,
    exerciseId: session.exerciseId,
    status: session.status,
    startedAt: new Date(session.startedAt).toISOString(),
    endedAt: new Date(session.endedAt).toISOString(),
    activeSeconds,
    pausedSeconds: Math.floor(session.pausedMs / 1000),
    targetSeconds: session.family === 'timeboxed' ? Math.round(session.targetMs / 1000) : null,
    unitsTotal: isSequence ? session.unitKeys.length : null,
    unitsCompleted: isSequence ? session.outcomes.filter((o) => o === 'done').length : null,
    unitsSkipped: isSequence ? session.outcomes.filter((o) => o === 'skipped').length : null,
    cyclesCompleted: cyclesCompleted(session),
    feeling,
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Persistence & recovery                                                                      */
/* ------------------------------------------------------------------------------------------ */

/**
 * Recovery rule: a session that was *running* when the page went away is restored as *paused*,
 * crediting active time only up to `savedAt` (the last checkpoint). Time after the checkpoint is
 * counted as paused, never as practice. A restored session only completes if its target had
 * already been reached at the checkpoint.
 */
export function recover(session: Session, savedAt: number, now: number): Session {
  if (session.status !== 'running') return session;
  // `pause` first syncs to the checkpoint, so a session that was already due completes there.
  return pause(session, Math.max(session.runningSince ?? 0, Math.min(savedAt, now)));
}
