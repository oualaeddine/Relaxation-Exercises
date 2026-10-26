import { describe, expect, it } from 'vitest';
import { normalizeConfig } from './config';
import { CSV_COLUMNS, csvField, exportFileName, parseBackup, toCsv, toJson } from './exportData';
import type { SessionRecord } from './types';
import { createSession, nextStep, start, toRecord } from '../engine/session';

const base: SessionRecord = {
  id: 'r1',
  exerciseId: 'expiration-levres-pincees',
  status: 'partial',
  startedAt: '2026-10-26T07:00:00.000Z',
  endedAt: '2026-10-26T07:02:30.000Z',
  activeSeconds: 120,
  pausedSeconds: 30,
  targetSeconds: 120,
  unitsTotal: null,
  unitsCompleted: null,
  unitsSkipped: null,
  cyclesCompleted: 20,
  feeling: 'calme',
};

/** Minimal RFC 4180 parser used to verify the export round-trips. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' && input[i + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
    } else field += ch;
  }
  return rows;
}

describe('CSV export', () => {
  it('starts with a BOM and the column names', () => {
    const csv = toCsv([]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(parseCsv(csv)).toEqual([[...CSV_COLUMNS]]);
  });

  it('writes the correct values for every record, preserving French accents', () => {
    const rows = parseCsv(toCsv([base, { ...base, id: 'r2', exerciseId: 'scan-corporel', status: 'completed', startedAt: '2026-10-26T09:00:00.000Z', endedAt: '2026-10-26T09:05:00.000Z', activeSeconds: 300, feeling: null }]));
    expect(rows).toHaveLength(3);
    const header = rows[0]!;
    const byName = (row: string[]) => Object.fromEntries(header.map((h, i) => [h, row[i]]));
    // Most recent first.
    expect(byName(rows[1]!)).toMatchObject({ id: 'r2', exercice: 'Scan corporel bienveillant', statut: 'Terminée', duree_active_secondes: '300', ressenti: '' });
    expect(byName(rows[2]!)).toMatchObject({
      id: 'r1',
      exercice_id: 'expiration-levres-pincees',
      exercice: 'Expiration à lèvres pincées',
      statut: 'Terminée plus tôt',
      debut_iso: '2026-10-26T07:00:00.000Z',
      duree_active_secondes: '120',
      duree_pause_secondes: '30',
      cycles_termines: '20',
      ressenti: 'Posé & calme',
    });
  });

  it('escapes commas, quotes, newlines and formula prefixes', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('dit "calme"')).toBe('"dit ""calme"""');
    expect(csvField('ligne 1\nligne 2')).toBe('"ligne 1\nligne 2"');
    expect(csvField('a;b')).toBe('"a;b"');
    expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvField('=1,2')).toBe(`"'=1,2"`);
    expect(csvField(null)).toBe('');
    expect(csvField(42)).toBe('42');
    const tricky = 'x, "y"\nz';
    expect(parseCsv(`${csvField(tricky)}\r\n`)).toEqual([[tricky]]);
  });
});

describe('JSON backup', () => {
  it('round-trips a valid backup', () => {
    const json = toJson([base], new Date('2026-10-26T10:00:00Z'));
    const parsed = parseBackup(json);
    expect(parsed).toEqual({ ok: true, records: [base], invalid: 0, duplicatesInFile: 0 });
    expect(JSON.parse(json)).toMatchObject({ app: 'calme', kind: 'historique', schemaVersion: 1, exportedAt: '2026-10-26T10:00:00.000Z' });
  });

  it('rejects invalid files with a useful message', () => {
    for (const bad of ['', 'nope', '[]', '{"app":"other"}', '{"app":"calme","kind":"historique","schemaVersion":1}']) {
      const result = parseBackup(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.length).toBeGreaterThan(10);
    }
  });

  it('rejects unsupported schema versions', () => {
    const result = parseBackup(JSON.stringify({ app: 'calme', kind: 'historique', schemaVersion: 2, sessions: [] }));
    expect(result).toEqual({ ok: false, error: expect.stringContaining('Version de sauvegarde non prise en charge (2)') });
  });

  it('counts invalid entries and duplicate ids deliberately', () => {
    const result = parseBackup(
      JSON.stringify({ app: 'calme', kind: 'historique', schemaVersion: 1, sessions: [base, { ...base, activeSeconds: 1 }, { id: 'x' }] }),
    );
    expect(result).toMatchObject({ ok: true, invalid: 1, duplicatesInFile: 1 });
    if (result.ok) expect(result.records[0]!.activeSeconds).toBe(120);
  });

  it('never contains grounding notes (they are not part of a session)', () => {
    let s = start(createSession('ancrage-sensoriel', normalizeConfig('ancrage-sensoriel'), 0, 'g'), 0);
    for (let i = 1; i <= 5; i += 1) s = nextStep(s, i * 10_000);
    const record = toRecord(s)!;
    expect(Object.keys(record)).not.toContain('notes');
    const json = toJson([record], new Date(60_000));
    expect(json).not.toMatch(/note|observation/i);
  });

  it('names files with the local date', () => {
    expect(exportFileName('csv', new Date(2026, 9, 26, 23, 59))).toBe('calme-historique-2026-10-26.csv');
  });
});
