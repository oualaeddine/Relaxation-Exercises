import type { ExerciseId, PhaseKey } from '../domain/types';

export interface PhaseText {
  badge: string;
  title: string;
  note: string;
}

const SLOW: Partial<Record<PhaseKey, PhaseText>> = {
  inhale: { badge: 'Inspiration', title: 'Inspirez doucement', note: 'Par le nez sans forcer' },
  exhale: { badge: 'Expiration', title: 'Expirez lentement', note: 'Sans effort, en relâchant les épaules' },
};

const BOX: Record<PhaseKey, PhaseText> = {
  inhale: { badge: 'Inspiration', title: 'Inspirez doucement', note: 'Par le nez, ventre souple' },
  'hold-in': { badge: 'Pause haute', title: 'Gardez l’air, sans forcer', note: 'Poumons pleins, épaules relâchées' },
  exhale: { badge: 'Expiration', title: 'Expirez sans forcer', note: 'Laissez l’air s’écouler' },
  'hold-out': { badge: 'Pause basse', title: 'Restez en douceur', note: 'Poumons vides, calme intérieur' },
};

const PURSED: Partial<Record<PhaseKey, PhaseText>> = {
  inhale: { badge: 'Inspiration nasale', title: 'Inspirez par le nez', note: 'Bouche fermée, inspirez tranquillement sans forcer.' },
  exhale: {
    badge: 'Expiration douce',
    title: 'Soufflez lentement',
    note: 'À travers les lèvres mi-closes, comme pour faire vaciller la flamme d’une bougie sans l’éteindre.',
  },
};

export function phaseText(exerciseId: ExerciseId, key: PhaseKey): PhaseText {
  const table = exerciseId === 'respiration-carree' ? BOX : exerciseId === 'expiration-levres-pincees' ? PURSED : SLOW;
  return table[key] ?? BOX[key];
}

/** Short cadence label, e.g. "4s / 6s" or "4-4-4-4". */
export function cadenceLabel(phases: readonly { key: PhaseKey; durationMs: number }[]): string {
  if (phases.length === 2) return phases.map((p) => `${p.durationMs / 1000}s`).join(' / ');
  return phases.map((p) => p.durationMs / 1000).join('-');
}
