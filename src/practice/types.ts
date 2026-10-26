import type { Exercise } from '../domain/exercises';
import type { ExerciseConfig } from '../domain/types';
import type { Session } from '../engine/session';
import type { Preferences } from '../storage/preferences';

/** Everything an exercise-specific live view needs. */
export interface PracticeApi {
  exercise: Exercise;
  /** The session brought up to date at `now` (pure view; the page commits ticks separately). */
  session: Session;
  now: number;
  activeMs: number;
  running: boolean;
  paused: boolean;
  reducedMotion: boolean;
  desktop: boolean;
  preferences: Preferences;
  setPreferences: (patch: Partial<Preferences>) => void;
  act: (action: (session: Session, at: number) => Session) => void;
  pause: () => void;
  resume: () => void;
  togglePause: () => void;
  /** Opens the "finish now?" confirmation (or finishes directly when nothing is lost). */
  requestFinish: () => void;
  requestRestart: () => void;
  openSettings: () => void;
  /** Applies a configuration to the live session (and remembers it for next time). */
  applyConfig: (config: ExerciseConfig) => { applied: boolean };
}
