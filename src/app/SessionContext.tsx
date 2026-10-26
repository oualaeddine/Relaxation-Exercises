import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type { ExerciseConfig, ExerciseId, Feeling, SessionRecord } from '../domain/types';
import { cancel, createSession, isEnded, isLive, pause, start, toRecord, type Session } from '../engine/session';
import { clearActiveSession, loadActiveSession, saveActiveSession } from '../storage/activeSession';
import type { WriteError } from '../storage/store';
import { useAppData } from './AppData';
import { now } from './clock';

/** While running, the live session is checkpointed at most this often (plus on page hide). */
export const CHECKPOINT_INTERVAL_MS = 10_000;

export type SaveState = 'pending' | 'saved' | 'not-recorded' | 'disabled' | 'error';

export interface SessionValue {
  session: Session | null;
  savedRecord: SessionRecord | null;
  saveState: SaveState;
  saveError: WriteError | null;
  feeling: Feeling | null;
  /** True when the current session was restored after a reload. */
  restored: boolean;
  begin: (exerciseId: ExerciseId, config: ExerciseConfig) => Session;
  act: (action: (session: Session, at: number) => Session) => Session | null;
  /** Forgets the current session (after the summary, or to abandon it). Live sessions are cancelled. */
  discard: () => void;
  retrySave: () => void;
  setFeeling: (feeling: Feeling | null) => void;
  checkpoint: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function practicePath(exerciseId: ExerciseId): string {
  return `/pratique/${exerciseId}`;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { store, addRecord, setFeeling: setRecordFeeling, preferences } = useAppData();
  const location = useLocation();
  const recordHistoryRef = useRef(preferences.recordHistory);
  recordHistoryRef.current = preferences.recordHistory;

  const restoredRef = useRef<Session | null | undefined>(undefined);
  if (restoredRef.current === undefined) restoredRef.current = loadActiveSession(store, now());

  const [session, setSession] = useState<Session | null>(restoredRef.current);
  const sessionRef = useRef<Session | null>(session);
  const [restored, setRestored] = useState(session !== null);
  const [savedRecord, setSavedRecord] = useState<SessionRecord | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('pending');
  const [saveError, setSaveError] = useState<WriteError | null>(null);
  const [feeling, setFeelingState] = useState<Feeling | null>(null);
  const lastSaveRef = useRef(0);

  const persistLive = useCallback(
    (s: Session) => {
      const at = now();
      lastSaveRef.current = at;
      saveActiveSession(store, s, at);
    },
    [store],
  );

  const finalize = useCallback(
    (s: Session) => {
      clearActiveSession(store);
      if (s.status === 'cancelled') return;
      const record = toRecord(s);
      if (!record) {
        setSavedRecord(null);
        setSaveState('not-recorded');
        return;
      }
      if (!recordHistoryRef.current) {
        setSavedRecord(record);
        setSaveState('disabled');
        return;
      }
      const result = addRecord(record);
      setSavedRecord(record);
      if (result.ok) {
        setSaveState('saved');
        setSaveError(null);
      } else {
        setSaveState('error');
        setSaveError(result.error);
      }
    },
    [store, addRecord],
  );

  const commit = useCallback(
    (prev: Session | null, next: Session | null) => {
      if (next === prev) return;
      sessionRef.current = next;
      setSession(next);
      if (!next) return;
      if (isEnded(next)) {
        if (!prev || !isEnded(prev) || prev.id !== next.id) finalize(next);
        return;
      }
      persistLive(next);
    },
    [finalize, persistLive],
  );

  // A session restored after reload may already be complete (target reached before the checkpoint).
  useEffect(() => {
    const initial = restoredRef.current;
    if (initial && isEnded(initial)) finalize(initial);
    else if (initial) persistLive(initial);
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const begin = useCallback(
    (exerciseId: ExerciseId, config: ExerciseConfig): Session => {
      const at = now();
      const previous = sessionRef.current;
      if (previous && isLive(previous)) clearActiveSession(store);
      const created = start(createSession(exerciseId, config, at), at);
      setSavedRecord(null);
      setSaveState('pending');
      setSaveError(null);
      setFeelingState(null);
      setRestored(false);
      commit(previous, created);
      return created;
    },
    [commit, store],
  );

  const act = useCallback(
    (action: (s: Session, at: number) => Session): Session | null => {
      const current = sessionRef.current;
      if (!current) return null;
      const next = action(current, now());
      commit(current, next);
      return next;
    },
    [commit],
  );

  const discard = useCallback(() => {
    const current = sessionRef.current;
    if (current && !isEnded(current)) {
      const cancelled = cancel(current, now());
      finalize(cancelled);
    }
    clearActiveSession(store);
    sessionRef.current = null;
    setSession(null);
    setSavedRecord(null);
    setSaveState('pending');
    setFeelingState(null);
    setRestored(false);
  }, [finalize, store]);

  const retrySave = useCallback(() => {
    const current = sessionRef.current;
    if (current && isEnded(current)) finalize(current);
  }, [finalize]);

  const setFeeling = useCallback(
    (value: Feeling | null) => {
      setFeelingState(value);
      const record = savedRecord;
      if (record && saveState === 'saved') setRecordFeeling(record.id, value);
    },
    [savedRecord, saveState, setRecordFeeling],
  );

  const checkpoint = useCallback(() => {
    const current = sessionRef.current;
    if (current && current.status === 'running' && now() - lastSaveRef.current >= CHECKPOINT_INTERVAL_MS) {
      persistLive(current);
    }
  }, [persistLive]);

  // Save a final checkpoint when the page is hidden or unloaded.
  useEffect(() => {
    const flush = () => {
      const current = sessionRef.current;
      if (current && current.status === 'running') persistLive(current);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [persistLive]);

  // Leaving the practice screen pauses a running session (no timer keeps running elsewhere).
  useEffect(() => {
    const current = sessionRef.current;
    if (current && current.status === 'running' && location.pathname !== practicePath(current.exerciseId)) {
      commit(current, pause(current, now()));
    }
  }, [location.pathname, commit]);

  const value = useMemo<SessionValue>(
    () => ({
      session,
      savedRecord,
      saveState,
      saveError,
      feeling,
      restored,
      begin,
      act,
      discard,
      retrySave,
      setFeeling,
      checkpoint,
    }),
    [session, savedRecord, saveState, saveError, feeling, restored, begin, act, discard, retrySave, setFeeling, checkpoint],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionContext(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSessionContext must be used inside <SessionProvider>');
  return value;
}
