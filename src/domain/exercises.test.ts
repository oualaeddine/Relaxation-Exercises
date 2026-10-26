import { describe, expect, it } from 'vitest';
import { normalizeConfig } from './config';
import { CATEGORIES, EXERCISES, GROUNDING_STEPS, getExercise, searchExercises } from './exercises';
import { EXERCISE_IDS, type ExerciseId, type ProtocolKind } from './types';

const EXPECTED: Record<ExerciseId, { title: string; category: string; protocol: ProtocolKind }> = {
  'respiration-lente': { title: 'Respiration lente', category: 'respiration', protocol: 'paced' },
  'respiration-carree': { title: 'Respiration carrée', category: 'respiration', protocol: 'paced' },
  'expiration-levres-pincees': { title: 'Expiration à lèvres pincées', category: 'respiration', protocol: 'paced' },
  'expiration-fredonnement': { title: 'Expiration avec fredonnement', category: 'respiration', protocol: 'repetitions' },
  'respiration-alternee': { title: 'Respiration alternée', category: 'respiration', protocol: 'steps' },
  'soupir-physiologique': { title: 'Soupir physiologique doux', category: 'respiration', protocol: 'repetitions' },
  'relaxation-musculaire': { title: 'Relaxation musculaire progressive', category: 'relaxation', protocol: 'steps' },
  'scan-corporel': { title: 'Scan corporel bienveillant', category: 'ancrage', protocol: 'steps' },
  'marche-attentive': { title: 'Marche attentive', category: 'mouvement', protocol: 'prompts' },
  'ancrage-sensoriel': { title: 'Ancrage sensoriel 5-4-3-2-1', category: 'ancrage', protocol: 'steps' },
};

describe('exercise catalog', () => {
  it('contains exactly the ten expected exercises, in library order', () => {
    expect(EXERCISES).toHaveLength(10);
    expect(EXERCISES.map((e) => e.id)).toEqual([...EXERCISE_IDS]);
  });

  it('uses unique, stable, URL-safe ids', () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(10);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each(Object.entries(EXPECTED))('%s has the expected title, category and protocol', (id, expected) => {
    const exercise = getExercise(id as ExerciseId);
    expect(exercise.title).toBe(expected.title);
    expect(exercise.category).toBe(expected.category);
    expect(exercise.protocol).toBe(expected.protocol);
  });

  it.each(EXERCISES.map((e) => [e.id, e] as const))('%s has French copy for every user-facing field', (_id, exercise) => {
    for (const text of [exercise.title, exercise.summary, exercise.instructions, exercise.benefits, exercise.safety, exercise.cue]) {
      expect(text.trim().length).toBeGreaterThan(5);
      // No leftover English placeholders.
      expect(text).not.toMatch(/lorem|TODO|placeholder|inhale|exhale/i);
    }
    expect(exercise.tags.length).toBeGreaterThan(0);
  });

  it('every exercise belongs to a supported category', () => {
    const ids = CATEGORIES.map((c) => c.id);
    for (const exercise of EXERCISES) expect(ids).toContain(exercise.category);
  });

  it('defaults normalise to themselves (valid durations and repetition targets)', () => {
    for (const exercise of EXERCISES) {
      expect(normalizeConfig(exercise, exercise.defaults)).toEqual(exercise.defaults);
      expect(exercise.defaults.durationSec).toBeGreaterThan(0);
      expect(exercise.defaults.repetitions).toBeGreaterThan(0);
      if (exercise.options.durations) expect(exercise.options.durations).toContain(exercise.defaults.durationSec);
    }
  });

  it('has the documented defaults for each protocol', () => {
    expect(getExercise('respiration-lente').defaults).toMatchObject({ inhaleSec: 4, exhaleSec: 6, durationSec: 300 });
    expect(getExercise('respiration-carree').defaults).toMatchObject({
      inhaleSec: 4,
      exhaleSec: 4,
      holdInEnabled: false,
      holdOutEnabled: false,
      durationSec: 240,
    });
    expect(getExercise('expiration-levres-pincees').defaults).toMatchObject({ inhaleSec: 2, exhaleSec: 4, durationSec: 120 });
    expect(getExercise('expiration-fredonnement').defaults.repetitions).toBe(5);
    expect(getExercise('soupir-physiologique').defaults.repetitions).toBe(3);
    expect(getExercise('marche-attentive').defaults.durationSec).toBe(600);
    expect(getExercise('scan-corporel').defaults.durationSec).toBe(300);
  });

  it('grounding uses the exact 5, 4, 3, 2, 1 progression', () => {
    expect(GROUNDING_STEPS.map((s) => s.count)).toEqual([5, 4, 3, 2, 1]);
    expect(getExercise('ancrage-sensoriel').units).toHaveLength(5);
  });

  it('guided exercises define their units', () => {
    expect(getExercise('relaxation-musculaire').units).toHaveLength(7);
    expect(getExercise('scan-corporel').units).toHaveLength(8);
    expect(getExercise('marche-attentive').units).toHaveLength(5);
    expect(getExercise('respiration-alternee').units).toHaveLength(4);
  });

  it('getExercise rejects unknown ids', () => {
    expect(() => getExercise('inconnu' as ExerciseId)).toThrow();
  });
});

describe('searchExercises', () => {
  it('returns everything for an empty query', () => {
    expect(searchExercises('', 'all')).toHaveLength(10);
  });

  it('is accent- and case-insensitive', () => {
    expect(searchExercises('CARREE', 'all').map((e) => e.id)).toEqual(['respiration-carree']);
    expect(searchExercises('PINCÉES', 'all').map((e) => e.id)).toEqual(['expiration-levres-pincees']);
  });

  it('filters by category', () => {
    expect(searchExercises('', 'relaxation').map((e) => e.id)).toEqual(['relaxation-musculaire']);
    expect(searchExercises('', 'ancrage').map((e) => e.id)).toEqual(['scan-corporel', 'ancrage-sensoriel']);
    expect(searchExercises('', 'mouvement').map((e) => e.id)).toEqual(['marche-attentive']);
    expect(searchExercises('', 'respiration')).toHaveLength(6);
  });

  it('combines query and category', () => {
    expect(searchExercises('marche', 'respiration')).toHaveLength(0);
    expect(searchExercises('scan', 'ancrage').map((e) => e.id)).toEqual(['scan-corporel']);
  });
});

describe('normalizeConfig', () => {
  it('rejects invalid values and falls back to defaults', () => {
    const config = normalizeConfig('respiration-lente', { inhaleSec: 0, exhaleSec: -3, durationSec: Number.NaN });
    expect(config).toMatchObject({ inhaleSec: 4, exhaleSec: 6, durationSec: 300 });
  });

  it('accepts allowed options and custom whole-minute durations', () => {
    expect(normalizeConfig('respiration-lente', { inhaleSec: 5, exhaleSec: 8, durationSec: 120 })).toMatchObject({
      inhaleSec: 5,
      exhaleSec: 8,
      durationSec: 120,
    });
    expect(normalizeConfig('respiration-lente', { durationSec: 10 }).durationSec).toBe(60);
  });

  it('clamps box-breathing ranges', () => {
    expect(normalizeConfig('respiration-carree', { inhaleSec: 20, holdInSec: 1 })).toMatchObject({ inhaleSec: 8, holdInSec: 2 });
  });

  it('never excludes every muscle group', () => {
    const all = ['mains', 'bras', 'epaules', 'visage', 'abdomen', 'cuisses', 'pieds'];
    expect(normalizeConfig('relaxation-musculaire', { excludedUnits: all }).excludedUnits).toEqual([]);
    expect(normalizeConfig('relaxation-musculaire', { excludedUnits: ['pieds', 'x'] }).excludedUnits).toEqual(['pieds']);
  });

  it('ignores fields that do not apply to an exercise', () => {
    expect(normalizeConfig('respiration-lente', { holdInEnabled: true }).holdInEnabled).toBe(false);
  });
});
