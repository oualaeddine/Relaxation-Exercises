import { useState } from 'react';
import { useAppData } from '../app/AppData';
import { downloadText } from '../app/download';
import { exportFileName, toCsv, toJson } from '../domain/exportData';
import { Icon } from '../ui/Icon';

/** CSV / JSON export of the whole stored history. */
export function ExportButtons() {
  const { records } = useAppData();
  const [message, setMessage] = useState<string | null>(null);
  const disabled = records.length === 0;
  const run = (kind: 'csv' | 'json') => {
    const now = new Date();
    const ok =
      kind === 'csv'
        ? downloadText(exportFileName('csv', now), toCsv(records), 'text/csv;charset=utf-8')
        : downloadText(exportFileName('json', now), toJson(records, now), 'application/json');
    setMessage(
      ok
        ? `Export ${kind.toUpperCase()} préparé : ${records.length} séance${records.length > 1 ? 's' : ''}.`
        : "Votre navigateur n'a pas pu générer le fichier.",
    );
  };
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => run('csv')}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-surface-container-low px-4 font-label-lg text-label-lg text-primary hover:bg-surface-container disabled:opacity-50"
        >
          <Icon name="download" size={20} />
          Exporter en CSV
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => run('json')}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-surface-container-low px-4 font-label-lg text-label-lg text-primary hover:bg-surface-container disabled:opacity-50"
        >
          <Icon name="download" size={20} />
          Sauvegarde JSON
        </button>
      </div>
      {disabled ? <p className="font-body-sm text-body-sm text-on-surface-variant">Aucune séance à exporter pour l’instant.</p> : null}
      {message ? (
        <p role="status" className="font-body-sm text-body-sm text-on-surface-variant">
          {message}
        </p>
      ) : null}
    </div>
  );
}
