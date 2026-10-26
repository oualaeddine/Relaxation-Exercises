import { ALTERNATE_STEPS, BODY_SCAN_ZONES, GROUNDING_STEPS, PMR_GROUPS, WALKING_PROMPTS } from '../domain/exercises';
import { activeMsAt, phaseAt, promptIndexAt, sequenceProgress, tick, type Session } from '../engine/session';
import { phaseText } from './phaseText';

export interface Moment {
  /** Changes exactly when a new phase / step / prompt begins. */
  key: string;
  /** Short status announced to screen readers (never the per-second countdown). */
  announce: string;
  /** Text spoken when voice guidance is on. */
  speech: string;
}

const HUM = { inhale: 'Inspirez par le nez', hum: 'Fredonnez en expirant', 'hum-free': 'Inspirez, puis fredonnez à votre rythme' } as const;
const SIGH = { inhale1: 'Inspirez doucement', inhale2: 'Petite deuxième inspiration', exhale: 'Expirez et relâchez' } as const;

/** Describes the current guided moment of a live session (pure). */
export function describeMoment(input: Session, now: number): Moment | null {
  const session = tick(input, now);
  const active = activeMsAt(session, now);
  if (session.family === 'timeboxed') {
    const t = Math.min(active, session.targetMs);
    if (session.prompts) {
      const index = promptIndexAt(session, t);
      const prompt = WALKING_PROMPTS[index]!;
      return { key: `prompt-${index}-${session.prompts.anchorMs}`, announce: `Invite ${index + 1} : ${prompt.title}`, speech: prompt.title };
    }
    const info = phaseAt(session.segments, t);
    const text = phaseText(session.exerciseId, info.phase.key);
    return { key: `${info.cycleIndex}-${info.phaseIndex}`, announce: text.badge, speech: text.title };
  }
  const p = sequenceProgress(session, now);
  const key = `${p.stepIndex}-${session.stepStartedMs}`;
  switch (session.exerciseId) {
    case 'expiration-fredonnement': {
      const text = HUM[p.step.key as keyof typeof HUM] ?? HUM['hum-free'];
      return { key, announce: `Répétition ${p.unit + 1} sur ${p.unitCount} : ${text}`, speech: text };
    }
    case 'soupir-physiologique': {
      const text = SIGH[p.step.key as keyof typeof SIGH] ?? '';
      return { key, announce: `Répétition ${p.unit + 1} : ${text}`, speech: text };
    }
    case 'respiration-alternee': {
      const step = ALTERNATE_STEPS[p.stepInUnit]!;
      return { key, announce: step.title, speech: step.title };
    }
    case 'relaxation-musculaire': {
      const group = PMR_GROUPS[p.unit]!;
      const kind = p.step.key.startsWith('tension') ? 'Contraction douce' : p.step.key.startsWith('release') ? 'Relâchement' : 'Observez la détente';
      return {
        key,
        announce: `${group.title} : ${kind}`,
        speech: p.step.key.startsWith('tension') ? `${group.title}. ${group.instruction}` : kind,
      };
    }
    case 'scan-corporel': {
      const zone = BODY_SCAN_ZONES[p.unit]!;
      return { key, announce: `Zone ${p.unit + 1} : ${zone.title}`, speech: `${zone.title}. ${zone.instruction}` };
    }
    case 'ancrage-sensoriel': {
      const step = GROUNDING_STEPS[p.unit]!;
      return { key, announce: '', speech: `${step.title}. ${step.instruction}` };
    }
    default:
      return null;
  }
}
