import type { Feeling, SessionRecord } from '../domain/types';
import { parseRecord, sortRecords } from './records';
import { safeRead, safeRemove, safeWrite, type KeyValueStore, type WriteResult } from './store';

export const HISTORY_KEY = 'calme.history';
export const HISTORY_SCHEMA_VERSION = 1;
export const HISTORY_BACKUP_PREFIX = 'calme.history.backup.';

/**
 * Stored format (v1): `{ "schemaVersion": 1, "sessions": SessionRecord[] }`.
 *
 * Policies
 * - Legacy v0 (a bare JSON array of records, used before versioning) is migrated to v1;
 *   valid records are preserved.
 * - Unparseable JSON or an unsupported (newer) schema version: the raw value is copied to a
 *   backup key, and history starts empty. If the backup cannot be written, writes are blocked
 *   so the original data is never overwritten silently.
 * - Individually invalid records are kept aside (never displayed, never deleted silently)
 *   and re-written untouched with the valid ones; the user can discard them explicitly.
 */
export type HistoryIssue =
  | { kind: 'corrupt'; backupKey: string | null }
  | { kind: 'unsupported-version'; version: unknown; backupKey: string | null }
  | { kind: 'invalid-records'; count: number }
  | { kind: 'migrated'; from: number };

export interface HistoryLoad {
  records: SessionRecord[];
  invalid: unknown[];
  issues: HistoryIssue[];
  /** True when the stored value could not be preserved: writes would destroy user data. */
  blocked: boolean;
  /** Migrated envelope to persist (when a migration happened). */
  needsWrite: boolean;
}

function backup(store: KeyValueStore, raw: string, now: number): string | null {
  const key = `${HISTORY_BACKUP_PREFIX}${now}`;
  return safeWrite(store, key, raw).ok ? key : null;
}

function splitRecords(items: unknown[]): { records: SessionRecord[]; invalid: unknown[] } {
  const records: SessionRecord[] = [];
  const invalid: unknown[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const record = parseRecord(item);
    if (!record) {
      invalid.push(item);
      continue;
    }
    if (seen.has(record.id)) continue; // duplicate id inside storage: first occurrence wins
    seen.add(record.id);
    records.push(record);
  }
  return { records: sortRecords(records), invalid };
}

export function loadHistory(store: KeyValueStore, now: number = Date.now()): HistoryLoad {
  const raw = safeRead(store, HISTORY_KEY);
  const empty: HistoryLoad = { records: [], invalid: [], issues: [], blocked: false, needsWrite: false };
  if (raw === null || raw === '') return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const backupKey = backup(store, raw, now);
    return { ...empty, issues: [{ kind: 'corrupt', backupKey }], blocked: backupKey === null };
  }

  let items: unknown[];
  const issues: HistoryIssue[] = [];
  let needsWrite = false;
  if (Array.isArray(parsed)) {
    items = parsed;
    issues.push({ kind: 'migrated', from: 0 });
    needsWrite = true;
  } else if (parsed && typeof parsed === 'object') {
    const envelope = parsed as { schemaVersion?: unknown; sessions?: unknown };
    if (envelope.schemaVersion !== HISTORY_SCHEMA_VERSION) {
      const backupKey = backup(store, raw, now);
      return {
        ...empty,
        issues: [{ kind: 'unsupported-version', version: envelope.schemaVersion, backupKey }],
        blocked: backupKey === null,
      };
    }
    if (!Array.isArray(envelope.sessions)) {
      const backupKey = backup(store, raw, now);
      return { ...empty, issues: [{ kind: 'corrupt', backupKey }], blocked: backupKey === null };
    }
    items = envelope.sessions;
  } else {
    const backupKey = backup(store, raw, now);
    return { ...empty, issues: [{ kind: 'corrupt', backupKey }], blocked: backupKey === null };
  }

  const { records, invalid } = splitRecords(items);
  if (invalid.length > 0) issues.push({ kind: 'invalid-records', count: invalid.length });
  return { records, invalid, issues, blocked: false, needsWrite };
}

export interface ImportSummary {
  added: number;
  duplicates: number;
}

/**
 * History repository backed by a key/value store. All mutations are write-through: the
 * in-memory state only changes when the write succeeds, so a failed write never leaves the UI
 * showing data that is not persisted.
 */
export class HistoryRepository {
  private records: SessionRecord[];
  private invalid: unknown[];
  readonly issues: HistoryIssue[];
  private blocked: boolean;

  constructor(
    private readonly store: KeyValueStore,
    now: number = Date.now(),
  ) {
    const load = loadHistory(store, now);
    this.records = load.records;
    this.invalid = load.invalid;
    this.issues = load.issues;
    this.blocked = load.blocked;
    if (load.needsWrite) this.persist(this.records, this.invalid);
  }

  all(): SessionRecord[] {
    return this.records;
  }

  get invalidCount(): number {
    return this.invalid.length;
  }

  get isBlocked(): boolean {
    return this.blocked;
  }

  has(id: string): boolean {
    return this.records.some((r) => r.id === id);
  }

  private persist(records: SessionRecord[], invalid: unknown[]): WriteResult {
    if (this.blocked) return { ok: false, error: 'unavailable' };
    const result = safeWrite(
      this.store,
      HISTORY_KEY,
      JSON.stringify({ schemaVersion: HISTORY_SCHEMA_VERSION, sessions: [...records, ...invalid] }),
    );
    if (result.ok) {
      this.records = sortRecords(records);
      this.invalid = invalid;
    }
    return result;
  }

  /** Idempotent: adding a record whose id already exists is a successful no-op. */
  add(record: SessionRecord): WriteResult & { duplicate?: boolean } {
    if (this.has(record.id)) return { ok: true, duplicate: true };
    const clean = parseRecord(record);
    if (!clean) return { ok: false, error: 'unavailable' };
    return this.persist([...this.records, clean], this.invalid);
  }

  setFeeling(id: string, feeling: Feeling | null): WriteResult {
    if (!this.has(id)) return { ok: true };
    return this.persist(
      this.records.map((r) => (r.id === id ? { ...r, feeling } : r)),
      this.invalid,
    );
  }

  remove(id: string): WriteResult {
    if (!this.has(id)) return { ok: true };
    return this.persist(
      this.records.filter((r) => r.id !== id),
      this.invalid,
    );
  }

  /** Deletes the whole history (including unreadable records and backups). */
  clear(): WriteResult {
    this.blocked = false;
    const result = safeRemove(this.store, HISTORY_KEY);
    if (result.ok) {
      this.records = [];
      this.invalid = [];
      this.issues.length = 0;
      removeBackups(this.store);
    }
    return result;
  }

  discardInvalid(): WriteResult {
    return this.persist(this.records, []);
  }

  /** Merges records (never replaces). Records whose id already exists are ignored. */
  importRecords(records: readonly SessionRecord[]): WriteResult & ImportSummary {
    const existing = new Set(this.records.map((r) => r.id));
    const toAdd: SessionRecord[] = [];
    let duplicates = 0;
    for (const record of records) {
      if (existing.has(record.id)) {
        duplicates += 1;
        continue;
      }
      existing.add(record.id);
      toAdd.push(record);
    }
    if (toAdd.length === 0) return { ok: true, added: 0, duplicates };
    const result = this.persist([...this.records, ...toAdd], this.invalid);
    return result.ok ? { ...result, added: toAdd.length, duplicates } : { ...result, added: 0, duplicates };
  }
}

export function removeBackups(store: KeyValueStore): void {
  try {
    const keys: string[] = [];
    const length = store.length ?? 0;
    for (let i = 0; i < length; i += 1) {
      const key = store.key?.(i);
      if (key && key.startsWith(HISTORY_BACKUP_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => store.removeItem(key));
  } catch {
    // Backups are best-effort.
  }
}
