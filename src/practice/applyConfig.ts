import { sameConfig } from '../domain/config';
import type { ExerciseConfig } from '../domain/types';
import { pacedPhases } from '../engine/plan';
import { applyCadence, isEnded, replan, setTarget, setUnitExcluded, type Session } from '../engine/session';

/**
 * Applies a new configuration to a live session where the engine allows it:
 * - paced breathing: new cadence (next cycle boundary, or immediately while paused) and duration;
 * - walking: duration;
 * - muscle relaxation: excluded / re-included future groups;
 * - other sequences: same-shape replans (repetition count, automatic pacing, scan duration).
 * Returns `applied: false` when part of the change can only take effect next session.
 */
export function applyConfigToSession(session: Session, config: ExerciseConfig, now: number): { session: Session; applied: boolean } {
  if (isEnded(session)) return { session, applied: false };
  let s = session;
  if (s.family === 'timeboxed') {
    const phases = s.segments.length > 0 ? pacedPhases(s.exerciseId, config) : null;
    const latest = s.segments[s.segments.length - 1];
    if (phases && latest && JSON.stringify(latest.phases) !== JSON.stringify(phases)) {
      s = applyCadence(s, phases, now);
    }
    if (s.family !== 'timeboxed') return { session: s, applied: false };
    const currentTarget = s.targetMs;
    const targetMs = config.durationSec * 1000;
    if (targetMs !== currentTarget) {
      const updated = setTarget(s, targetMs, now);
      if (updated === s) return { session: { ...s, config: { ...config, durationSec: currentTarget / 1000 } }, applied: false };
      s = updated;
    }
    return { session: { ...s, config }, applied: true };
  }
  if (s.exerciseId === 'relaxation-musculaire') {
    s.unitKeys.forEach((key, unit) => {
      const want = config.excludedUnits.includes(key);
      if (s.family === 'sequence' && s.excluded[unit] !== want) s = setUnitExcluded(s, unit, want, now);
    });
    const applied = s.family === 'sequence' && s.unitKeys.every((key, u) => (s as Extract<Session, { family: 'sequence' }>).excluded[u] === config.excludedUnits.includes(key));
    const presetSame = s.config.pmrPreset === config.pmrPreset;
    return { session: s, applied: applied && presetSame };
  }
  if (sameConfig(s.config, config)) return { session: s, applied: true };
  const replanned = replan(s, config, now);
  return { session: replanned, applied: replanned !== s };
}
