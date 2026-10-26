import { parseRecord, sortRecords } from '../storage/records';
import { getExercise } from './exercises';
import type { Feeling, SessionRecord } from './types';

export const BACKUP_APP = 'calme';
export const BACKUP_KIND = 'historique';
export const BACKUP_SCHEMA_VERSION = 1;

const FEELING_LABELS: Record<Feeling, string> = {
  leger: 'Plus léger',
  calme: 'Posé & calme',
  tendu: 'Encore tendu',
};

export function feelingLabel(feeling: Feeling | null): string {
  return feeling ? FEELING_LABELS[feeling] : '';
}

export const STATUS_LABELS = { completed: 'Terminée', partial: 'Terminée plus tôt' } as const;

export const CSV_COLUMNS = [
  'id',
  'exercice_id',
  'exercice',
  'statut',
  'debut_iso',
  'fin_iso',
  'date_locale',
  'duree_active_secondes',
  'duree_pause_secondes',
  'objectif_secondes',
  'unites_terminees',
  'unites_passees',
  'unites_total',
  'cycles_termines',
  'ressenti',
] as const;

/** RFC 4180 field escaping (comma, quote, CR/LF, leading/trailing spaces, semicolons). */
export function csvField(value: string | number | null): string {
  if (value === null) return '';
  let text = String(value);
  // Neutralise spreadsheet formula injection.
  if (typeof value === 'string' && /^[=+\-@\t]/.test(text)) text = `'${text}`;
  if (/[",\r\n;]|^\s|\s$/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

const localFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

/** CSV export (UTF-8 with BOM for spreadsheet apps, CRLF line endings), most recent first. */
export function toCsv(records: readonly SessionRecord[]): string {
  const rows = sortRecords(records).map((r) =>
    [
      r.id,
      r.exerciseId,
      getExercise(r.exerciseId).title,
      STATUS_LABELS[r.status],
      r.startedAt,
      r.endedAt,
      localFormatter.format(new Date(r.startedAt)),
      r.activeSeconds,
      r.pausedSeconds,
      r.targetSeconds,
      r.unitsCompleted,
      r.unitsSkipped,
      r.unitsTotal,
      r.cyclesCompleted,
      feelingLabel(r.feeling),
    ]
      .map(csvField)
      .join(','),
  );
  return `\uFEFF${[CSV_COLUMNS.join(','), ...rows].join('\r\n')}\r\n`;
}

export interface Backup {
  app: typeof BACKUP_APP;
  kind: typeof BACKUP_KIND;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  sessions: SessionRecord[];
}

export function toBackup(records: readonly SessionRecord[], now: Date): Backup {
  return {
    app: BACKUP_APP,
    kind: BACKUP_KIND,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    sessions: sortRecords(records),
  };
}

export function toJson(records: readonly SessionRecord[], now: Date): string {
  return `${JSON.stringify(toBackup(records, now), null, 2)}\n`;
}

export type ImportParse =
  | {
      ok: true;
      records: SessionRecord[];
      /** Entries rejected because they are invalid. */
      invalid: number;
      /** Entries whose id appears more than once in the file (first one kept). */
      duplicatesInFile: number;
    }
  | { ok: false; error: string };

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/**
 * Parses a JSON backup. Policy:
 * - only Calme backups (`app: "calme"`, `kind: "historique"`) are accepted;
 * - only schema version 1 is supported — other versions are rejected with a message;
 * - invalid entries are counted and skipped; duplicate ids within the file keep the first one;
 * - the result is merged by the caller (never replaces the existing history).
 */
export function parseBackup(text: string): ImportParse {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: 'Le fichier est trop volumineux (5 Mo maximum).' };
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return { ok: false, error: "Ce fichier n'est pas un JSON valide. Choisissez une sauvegarde exportée depuis Calme." };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: "Ce fichier n'est pas une sauvegarde Calme." };
  }
  const backup = data as Record<string, unknown>;
  if (backup.app !== BACKUP_APP || backup.kind !== BACKUP_KIND) {
    return { ok: false, error: "Ce fichier n'est pas une sauvegarde de l'historique Calme." };
  }
  if (backup.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Version de sauvegarde non prise en charge (${String(backup.schemaVersion)}). Cette version de Calme lit uniquement la version ${BACKUP_SCHEMA_VERSION}.`,
    };
  }
  if (!Array.isArray(backup.sessions)) {
    return { ok: false, error: 'La sauvegarde ne contient pas de liste de séances.' };
  }
  const records: SessionRecord[] = [];
  const seen = new Set<string>();
  let invalid = 0;
  let duplicatesInFile = 0;
  for (const item of backup.sessions) {
    const record = parseRecord(item);
    if (!record) {
      invalid += 1;
      continue;
    }
    if (seen.has(record.id)) {
      duplicatesInFile += 1;
      continue;
    }
    seen.add(record.id);
    records.push(record);
  }
  return { ok: true, records, invalid, duplicatesInFile };
}

export function exportFileName(kind: 'csv' | 'json', now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `calme-historique-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.${kind}`;
}
