import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppData } from '../app/AppData';
import { useDocumentTitle } from '../app/hooks';
import { ExportButtons } from '../components/ExportButtons';
import { LiveSessionBanner } from '../components/LiveSessionBanner';
import { WeeklyChart } from '../components/WeeklyChart';
import { EXERCISES, getExercise } from '../domain/exercises';
import { STATUS_LABELS, feelingLabel } from '../domain/exportData';
import { formatDateTime, formatDuration, formatLongDate, formatTime, wholeMinutes } from '../domain/format';
import { computeStats, filterRecords, summarize } from '../domain/stats';
import type { ExerciseId, SessionRecord } from '../domain/types';
import { WRITE_ERROR_MESSAGES } from '../storage/store';
import { PageLayout } from '../layout/AppShell';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { ProgressBar } from '../practice/shared';

function StatTile({ label, value, unit, testId }: { label: string; value: string | number; unit?: string; testId: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
      <dt className="font-label-sm text-label-sm text-on-surface-variant">{label}</dt>
      <dd className="flex items-baseline gap-1">
        <span className="font-headline-lg text-headline-lg font-bold text-primary" data-testid={testId}>
          {value}
        </span>
        {unit ? <span className="font-label-md text-label-md text-on-surface-variant">{unit}</span> : null}
      </dd>
    </div>
  );
}

function unitsText(r: SessionRecord): string | null {
  if (r.unitsTotal !== null) {
    return `${r.unitsCompleted ?? 0} / ${r.unitsTotal} étapes${r.unitsSkipped ? ` · ${r.unitsSkipped} passée${r.unitsSkipped > 1 ? 's' : ''}` : ''}`;
  }
  if (r.cyclesCompleted !== null) return `${r.cyclesCompleted} cycles complets`;
  return null;
}

export function HistoryPage() {
  useDocumentTitle('Mon suivi');
  const { records, preferences, removeRecord, invalidCount } = useAppData();
  const [exerciseId, setExerciseId] = useState<ExerciseId | 'all'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<SessionRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { ex: useId(), from: useId(), to: useId() };

  const stats = useMemo(() => computeStats(records, new Date(), preferences.weeklyGoalMinutes), [records, preferences.weeklyGoalMinutes]);
  const rangeError = from && to && from > to ? 'La date de début doit précéder la date de fin.' : null;
  const filtered = useMemo(() => (rangeError ? [] : filterRecords(records, { exerciseId, from: from || undefined, to: to || undefined })), [records, exerciseId, from, to, rangeError]);
  const filteredSummary = summarize(filtered);
  const filtering = exerciseId !== 'all' || from !== '' || to !== '';
  const maxShare = Math.max(...stats.distribution.map((d) => d.seconds), 1);

  return (
    <PageLayout variant="tab" title="Mon suivi" wide>
      <div className="flex flex-col gap-space-lg">
        <LiveSessionBanner />
        <div>
          <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-secondary">Écoute de soi</span>
          <h2 className="font-headline-md text-headline-md text-primary">Mon suivi</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Calculé uniquement à partir des séances enregistrées sur cet appareil. Les pauses ne sont jamais comptées.</p>
        </div>

        {invalidCount > 0 ? (
          <p role="status" className="rounded-2xl bg-surface-container-high p-3 font-body-sm text-body-sm text-on-surface">
            {invalidCount} enregistrement{invalidCount > 1 ? 's' : ''} illisible{invalidCount > 1 ? 's ont' : ' a'} été mis de côté. Vous pouvez les gérer dans{' '}
            <Link to="/parametres" className="font-semibold text-secondary underline">
              Paramètres
            </Link>
            .
          </p>
        ) : null}

        <dl className="grid grid-cols-2 gap-space-sm lg:grid-cols-4">
          <StatTile label="Temps de pratique total" value={wholeMinutes(stats.totalSeconds)} unit="min" testId="total-minutes" />
          <StatTile label="Séances terminées" value={stats.completedSessions} testId="completed-count" />
          <StatTile label="Terminées plus tôt" value={stats.partialSessions} testId="partial-count" />
          <StatTile label="Cette semaine" value={wholeMinutes(stats.weekSeconds)} unit={`/ ${preferences.weeklyGoalMinutes} min`} testId="week-minutes" />
        </dl>

        {records.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface-container-lowest p-8 text-center shadow-sm">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-secondary">
              <Icon name="history" size={32} />
            </span>
            <h3 className="font-headline-sm text-headline-sm text-primary">Aucune séance enregistrée</h3>
            <p className="max-w-sm font-body-sm text-body-sm text-on-surface-variant">Vos séances terminées apparaîtront ici. Rien n’est inventé : seules vos pratiques réelles sont prises en compte.</p>
            <Link to="/exercices" className="flex min-h-[48px] items-center rounded-full bg-primary-container px-5 font-label-lg text-label-lg text-on-primary hover:bg-secondary">
              Choisir un exercice
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-2">
              <section className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-lowest p-space-lg shadow-sm" aria-labelledby="week-progress-title">
                <h3 id="week-progress-title" className="font-headline-sm text-headline-sm text-on-surface">
                  Objectif hebdomadaire
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {wholeMinutes(stats.weekSeconds)} min sur {preferences.weeklyGoalMinutes} min cette semaine ({stats.weekSessions} séance{stats.weekSessions > 1 ? 's' : ''}).
                </p>
                <ProgressBar value={stats.weeklyProgress} label="Progression de l'objectif hebdomadaire" />
                <h3 className="pt-space-sm font-label-lg text-label-lg text-on-surface">Minutes par jour (7 derniers jours)</h3>
                <WeeklyChart days={stats.last7Days} />
              </section>
              <section className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-lowest p-space-lg shadow-sm" aria-labelledby="distribution-title">
                <h3 id="distribution-title" className="font-headline-sm text-headline-sm text-on-surface">
                  Répartition par exercice
                </h3>
                <ul className="flex flex-col gap-3">
                  {stats.distribution.map((entry) => (
                    <li key={entry.exerciseId} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between font-label-md text-label-md">
                        <span className="text-on-surface">{getExercise(entry.exerciseId).title}</span>
                        <span className="text-on-surface-variant">
                          {entry.sessions} séance{entry.sessions > 1 ? 's' : ''} · {formatDuration(entry.seconds)} · {Math.round(entry.share * 100)} %
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container" aria-hidden="true">
                        <div className="h-full rounded-full bg-secondary" style={{ width: `${(entry.seconds / maxShare) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="flex flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-space-lg shadow-sm" aria-labelledby="sessions-title">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="sessions-title" className="font-headline-sm text-headline-sm text-on-surface">
                  Historique des séances
                </h3>
                <span className="font-label-md text-label-md text-on-surface-variant" data-testid="filtered-summary">
                  {filteredSummary.sessions} séance{filteredSummary.sessions > 1 ? 's' : ''} · {formatDuration(filteredSummary.seconds)}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="group" aria-label="Filtres">
                <label htmlFor={ids.ex} className="flex flex-col gap-1 font-label-md text-label-md text-on-surface-variant">
                  Exercice
                  <select
                    id={ids.ex}
                    value={exerciseId}
                    onChange={(e) => setExerciseId(e.target.value as ExerciseId | 'all')}
                    className="h-12 rounded-2xl border border-mineral bg-surface-container-lowest px-3 font-body-sm text-body-sm text-on-surface focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary"
                  >
                    <option value="all">Tous les exercices</option>
                    {EXERCISES.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor={ids.from} className="flex flex-col gap-1 font-label-md text-label-md text-on-surface-variant">
                  Du
                  <input id={ids.from} type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-12 rounded-2xl border border-mineral bg-surface-container-lowest px-3 font-body-sm text-body-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary" />
                </label>
                <label htmlFor={ids.to} className="flex flex-col gap-1 font-label-md text-label-md text-on-surface-variant">
                  Au
                  <input
                    id={ids.to}
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    aria-invalid={rangeError !== null}
                    className="h-12 rounded-2xl border border-mineral bg-surface-container-lowest px-3 font-body-sm text-body-sm focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                </label>
              </div>
              {rangeError ? (
                <p role="alert" className="font-body-sm text-body-sm text-error">
                  {rangeError}
                </p>
              ) : null}
              {filtering ? (
                <button
                  type="button"
                  onClick={() => {
                    setExerciseId('all');
                    setFrom('');
                    setTo('');
                  }}
                  className="min-h-[44px] self-start rounded-full bg-surface-container-low px-4 font-label-md text-label-md text-primary"
                >
                  Réinitialiser les filtres
                </button>
              ) : null}
              {filtered.length === 0 ? (
                <p className="rounded-xl bg-surface-container-low p-4 text-center font-body-sm text-body-sm text-on-surface-variant">Aucune séance ne correspond à ces filtres.</p>
              ) : (
                <ul className="flex flex-col gap-2" aria-label="Séances" data-testid="session-list">
                  {filtered.map((record) => (
                    <li key={record.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(record)}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl bg-surface-container-low p-3 text-left hover:bg-surface-container"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-secondary">
                            <Icon name={getExercise(record.exerciseId).icon} size={20} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-label-lg text-label-lg text-on-surface">{getExercise(record.exerciseId).title}</span>
                            <span className="block font-body-sm text-body-sm text-on-surface-variant">{formatDateTime(record.startedAt)}</span>
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end">
                          <span className="font-label-lg text-label-lg text-primary">{formatDuration(record.activeSeconds)}</span>
                          <span className={`rounded-full px-2 py-0.5 font-label-sm text-label-sm ${record.status === 'completed' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high text-on-surface-variant'}`}>
                            {STATUS_LABELS[record.status]}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        <section className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-lowest p-space-lg shadow-sm" aria-labelledby="export-title">
          <h3 id="export-title" className="font-headline-sm text-headline-sm text-on-surface">
            Exporter mon historique
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Le fichier est généré sur votre appareil ; rien n’est envoyé sur Internet.</p>
          <ExportButtons />
        </section>
      </div>

      <Dialog
        open={selected !== null}
        onClose={() => {
          setSelected(null);
          setConfirmDelete(false);
          setError(null);
        }}
        title={selected ? getExercise(selected.exerciseId).title : ''}
        showClose
      >
        {selected ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 font-body-sm text-body-sm">
              <div>
                <dt className="text-on-surface-variant">Date</dt>
                <dd className="text-on-surface">{formatLongDate(selected.startedAt)}</dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">Horaire</dt>
                <dd className="text-on-surface">
                  {formatTime(selected.startedAt)} – {formatTime(selected.endedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">Pratique active</dt>
                <dd className="font-semibold text-primary">{formatDuration(selected.activeSeconds)}</dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">Pauses (non comptées)</dt>
                <dd className="text-on-surface">{formatDuration(selected.pausedSeconds)}</dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">Statut</dt>
                <dd className="text-on-surface">{STATUS_LABELS[selected.status]}</dd>
              </div>
              {selected.targetSeconds !== null ? (
                <div>
                  <dt className="text-on-surface-variant">Objectif</dt>
                  <dd className="text-on-surface">{formatDuration(selected.targetSeconds)}</dd>
                </div>
              ) : null}
              {unitsText(selected) ? (
                <div>
                  <dt className="text-on-surface-variant">Progression</dt>
                  <dd className="text-on-surface">{unitsText(selected)}</dd>
                </div>
              ) : null}
              {selected.feeling ? (
                <div>
                  <dt className="text-on-surface-variant">Ressenti</dt>
                  <dd className="text-on-surface">{feelingLabel(selected.feeling)}</dd>
                </div>
              ) : null}
            </dl>
            {error ? (
              <p role="alert" className="rounded-xl bg-error-container p-3 font-body-sm text-body-sm text-on-error-container">
                {error}
              </p>
            ) : null}
            {confirmDelete ? (
              <div className="space-y-2 rounded-2xl bg-error-container/50 p-3">
                <p className="font-body-sm text-body-sm text-on-surface">Supprimer définitivement cette séance de votre historique ?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const result = removeRecord(selected.id);
                      if (result.ok) {
                        setSelected(null);
                        setConfirmDelete(false);
                      } else {
                        setError(WRITE_ERROR_MESSAGES[result.error]);
                      }
                    }}
                    className="min-h-[44px] flex-1 rounded-full bg-error px-4 font-label-lg text-label-lg text-on-error"
                  >
                    Confirmer la suppression
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-[44px] flex-1 rounded-full bg-surface-container-lowest px-4 font-label-lg text-label-lg text-on-surface">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="flex min-h-[44px] items-center gap-2 rounded-full px-2 font-label-lg text-label-lg text-error">
                <Icon name="delete" size={20} />
                Supprimer cette séance
              </button>
            )}
          </div>
        ) : null}
      </Dialog>
    </PageLayout>
  );
}
