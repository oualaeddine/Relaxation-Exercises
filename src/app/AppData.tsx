import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Feeling, SessionRecord } from '../domain/types';
import { HistoryRepository, type HistoryIssue, type ImportSummary } from '../storage/history';
import {
  DEFAULT_PREFERENCES,
  clearPreferences,
  loadPreferences,
  savePreferences,
  type Preferences,
} from '../storage/preferences';
import { getBrowserStore, type KeyValueStore, type WriteResult } from '../storage/store';

export interface AppDataValue {
  store: KeyValueStore;
  /** False when localStorage is unavailable: nothing survives a reload. */
  persistent: boolean;
  records: SessionRecord[];
  historyIssues: HistoryIssue[];
  invalidCount: number;
  historyBlocked: boolean;
  preferences: Preferences;
  preferencesReset: boolean;
  addRecord: (record: SessionRecord) => WriteResult;
  setFeeling: (id: string, feeling: Feeling | null) => WriteResult;
  removeRecord: (id: string) => WriteResult;
  clearHistory: () => WriteResult;
  discardInvalid: () => WriteResult;
  importRecords: (records: SessionRecord[]) => WriteResult & ImportSummary;
  updatePreferences: (patch: Partial<Preferences>) => WriteResult;
  resetPreferences: () => WriteResult;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children, store: injected }: { children: ReactNode; store?: KeyValueStore }) {
  const initial = useRef<{ store: KeyValueStore; persistent: boolean } | null>(null);
  if (initial.current === null) initial.current = injected ? { store: injected, persistent: true } : getBrowserStore();
  const { store, persistent } = initial.current;

  const repoRef = useRef<HistoryRepository | null>(null);
  if (repoRef.current === null) repoRef.current = new HistoryRepository(store);
  const repo = repoRef.current;

  const [records, setRecords] = useState<SessionRecord[]>(() => repo.all());
  const [invalidCount, setInvalidCount] = useState(repo.invalidCount);
  const [issues, setIssues] = useState<HistoryIssue[]>(() => [...repo.issues]);
  const [blocked, setBlocked] = useState(repo.isBlocked);
  const [{ preferences, reset }, setPrefsState] = useState(() => {
    const load = loadPreferences(store);
    return { preferences: load.preferences, reset: load.reset };
  });

  const sync = useCallback(<T extends WriteResult>(result: T): T => {
    setRecords(repo.all());
    setInvalidCount(repo.invalidCount);
    setIssues([...repo.issues]);
    setBlocked(repo.isBlocked);
    return result;
  }, [repo]);

  const prefsRef = useRef(preferences);
  prefsRef.current = preferences;
  const updatePreferences = useCallback(
    (patch: Partial<Preferences>): WriteResult => {
      const next: Preferences = { ...prefsRef.current, ...patch, schemaVersion: 1 };
      prefsRef.current = next;
      const result = savePreferences(store, next);
      // Preferences still apply for this visit even if they could not be saved.
      setPrefsState((current) => ({ preferences: next, reset: current.reset }));
      return result;
    },
    [store],
  );

  const value = useMemo<AppDataValue>(
    () => ({
      store,
      persistent,
      records,
      historyIssues: issues,
      invalidCount,
      historyBlocked: blocked,
      preferences,
      preferencesReset: reset,
      addRecord: (record) => sync(repo.add(record)),
      setFeeling: (id, feeling) => sync(repo.setFeeling(id, feeling)),
      removeRecord: (id) => sync(repo.remove(id)),
      clearHistory: () => sync(repo.clear()),
      discardInvalid: () => sync(repo.discardInvalid()),
      importRecords: (list) => sync(repo.importRecords(list)),
      updatePreferences,
      resetPreferences: () => {
        const result = clearPreferences(store);
        setPrefsState({ preferences: { ...DEFAULT_PREFERENCES, exerciseConfigs: {} }, reset: false });
        return result;
      },
    }),
    [store, persistent, records, issues, invalidCount, blocked, preferences, reset, repo, sync, updatePreferences],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const value = useContext(AppDataContext);
  if (!value) throw new Error('useAppData must be used inside <AppDataProvider>');
  return value;
}
