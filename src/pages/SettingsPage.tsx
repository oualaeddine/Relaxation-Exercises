import { useId, useRef, useState, type ReactNode } from 'react';
import { useAppData } from '../app/AppData';
import { readFileText } from '../app/download';
import { speechAvailable } from '../app/feedback';
import { useDocumentTitle } from '../app/hooks';
import { ExportButtons } from '../components/ExportButtons';
import { SAFETY_NOTE } from '../domain/exercises';
import { MAX_IMPORT_BYTES, parseBackup } from '../domain/exportData';
import type { SessionRecord } from '../domain/types';
import { WEEKLY_GOAL_RANGE, type MotionPreference, type SoundTimbre } from '../storage/preferences';
import { WRITE_ERROR_MESSAGES } from '../storage/store';
import { PageLayout } from '../layout/AppShell';
import { ChoiceGroup, SafetyNote, Switch } from '../ui/controls';
import { Dialog } from '../ui/Dialog';
import { Icon, type IconName } from '../ui/Icon';

function Section({ title, icon, children, id }: { title: string; icon: IconName; children: ReactNode; id: string }) {
  return (
    <section className="space-y-4 rounded-2xl bg-surface-container-lowest p-5 shadow-sm" aria-labelledby={id}>
      <h2 id={id} className="flex items-center gap-2 font-headline-sm text-headline-sm text-on-surface">
        <Icon name={icon} size={22} className="text-secondary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

interface PendingImport {
  fileName: string;
  records: SessionRecord[];
  invalid: number;
  duplicatesInFile: number;
  alreadyPresent: number;
}

export function SettingsPage() {
  useDocumentTitle('Paramètres');
  const app = useAppData();
  const { preferences: prefs, updatePreferences } = app;
  const goalId = useId();
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [goalDraft, setGoalDraft] = useState(String(prefs.weeklyGoalMinutes));
  const [goalError, setGoalError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const report = (result: { ok: true } | { ok: false; error: 'quota' | 'unavailable' }, success: string) => {
    setStatus(result.ok ? { tone: 'ok', text: success } : { tone: 'error', text: WRITE_ERROR_MESSAGES[result.error] });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setStatus({ tone: 'error', text: 'Le fichier est trop volumineux (5 Mo maximum).' });
      return;
    }
    let text: string;
    try {
      text = await readFileText(file);
    } catch {
      setStatus({ tone: 'error', text: 'Le fichier n’a pas pu être lu.' });
      return;
    }
    const parsed = parseBackup(text);
    if (fileRef.current) fileRef.current.value = '';
    if (!parsed.ok) {
      setStatus({ tone: 'error', text: parsed.error });
      return;
    }
    const existing = new Set(app.records.map((r) => r.id));
    setPendingImport({
      fileName: file.name,
      records: parsed.records,
      invalid: parsed.invalid,
      duplicatesInFile: parsed.duplicatesInFile,
      alreadyPresent: parsed.records.filter((r) => existing.has(r.id)).length,
    });
  };

  const issues = app.historyIssues.filter((i) => i.kind !== 'migrated');

  return (
    <PageLayout variant="tab" title="Paramètres">
      <div className="flex flex-col gap-space-lg">
        <div>
          <h2 className="font-headline-md text-headline-md text-primary">Paramètres</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Vos préférences sont enregistrées sur cet appareil uniquement.</p>
        </div>

        {status ? (
          <div
            role={status.tone === 'error' ? 'alert' : 'status'}
            className={`flex items-start justify-between gap-2 rounded-2xl p-3 font-body-sm text-body-sm ${
              status.tone === 'error' ? 'bg-error-container text-on-error-container' : 'bg-secondary-container/50 text-on-surface'
            }`}
          >
            <span>{status.text}</span>
            <button type="button" aria-label="Fermer le message" onClick={() => setStatus(null)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
              <Icon name="close" size={18} />
            </button>
          </div>
        ) : null}

        {issues.length > 0 || app.invalidCount > 0 || app.preferencesReset ? (
          <Section title="État des données" icon="warning" id="data-state">
            <ul className="space-y-2 font-body-sm text-body-sm text-on-surface">
              {issues.map((issue, i) => (
                <li key={i} className="rounded-xl bg-surface-container-low p-3">
                  {issue.kind === 'corrupt'
                    ? `L'historique enregistré était illisible. ${issue.backupKey ? 'Une copie a été conservée dans le stockage du navigateur.' : "Impossible d'en conserver une copie : l'enregistrement est suspendu pour ne rien écraser."}`
                    : issue.kind === 'unsupported-version'
                      ? `L'historique provient d'une version plus récente de Calme. ${issue.backupKey ? 'Il a été mis de côté (copie conservée) et un nouvel historique a démarré.' : "L'enregistrement est suspendu pour ne rien écraser."}`
                      : issue.kind === 'invalid-records'
                        ? `${issue.count} enregistrement(s) illisible(s) ont été mis de côté. Ils ne sont pas affichés et ne comptent pas dans les statistiques.`
                        : null}
                </li>
              ))}
              {app.preferencesReset ? <li className="rounded-xl bg-surface-container-low p-3">Vos préférences étaient illisibles : les réglages par défaut ont été appliqués.</li> : null}
            </ul>
            <div className="flex flex-wrap gap-2">
              {app.invalidCount > 0 ? (
                <button type="button" onClick={() => report(app.discardInvalid(), 'Les enregistrements illisibles ont été supprimés.')} className="min-h-[44px] rounded-full bg-surface-container-low px-4 font-label-lg text-label-lg text-primary">
                  Supprimer les données illisibles
                </button>
              ) : null}
              {app.historyBlocked ? (
                <button type="button" onClick={() => setConfirmClear(true)} className="min-h-[44px] rounded-full bg-surface-container-low px-4 font-label-lg text-label-lg text-error">
                  Réinitialiser l'historique
                </button>
              ) : null}
            </div>
          </Section>
        ) : null}

        <Section title="Sons & sensations" icon="notifications_active" id="sound-settings">
          <Switch icon="volume_up" label="Guide sonore" description="Carillon doux à chaque changement de phase ou d'étape." checked={prefs.sound} onChange={(v) => updatePreferences({ sound: v })} />
          <ChoiceGroup<SoundTimbre>
            label="Timbre du carillon"
            value={prefs.soundTimbre}
            columns={2}
            options={[
              { value: 'bol', label: 'Bol tibétain' },
              { value: 'carillon', label: 'Carillon doux' },
            ]}
            onChange={(v) => updatePreferences({ soundTimbre: v })}
          />
          <label className="flex flex-col gap-1">
            <span className="flex justify-between font-label-md text-label-md text-on-surface-variant">
              <span>Volume du guide</span>
              <span className="font-semibold text-primary">{prefs.volume} %</span>
            </span>
            <input type="range" min={0} max={100} value={prefs.volume} onChange={(e) => updatePreferences({ volume: Number(e.target.value) })} className="h-2 w-full cursor-pointer accent-secondary" />
          </label>
          <Switch icon="mobile_vibrate" label="Vibrations" description="Une courte vibration aux transitions (sur les appareils compatibles)." checked={prefs.haptics} onChange={(v) => updatePreferences({ haptics: v })} />
          <Switch
            icon="record_voice_over"
            label="Guidage vocal"
            description={speechAvailable() ? 'Lecture des consignes en français par la synthèse vocale de votre appareil.' : "La synthèse vocale n'est pas disponible dans ce navigateur."}
            checked={prefs.voice}
            disabled={!speechAvailable()}
            onChange={(v) => updatePreferences({ voice: v })}
          />
        </Section>

        <Section title="Animations" icon="contrast" id="motion-settings">
          <ChoiceGroup<MotionPreference>
            label="Mouvements des visuels de respiration"
            value={prefs.motion}
            columns={2}
            options={[
              { value: 'system', label: "Selon l'appareil" },
              { value: 'reduce', label: 'Toujours réduits' },
            ]}
            onChange={(v) => updatePreferences({ motion: v })}
          />
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            En mode réduit, les cercles ne s'animent plus : la phase reste indiquée par le texte et le compte à rebours.
          </p>
        </Section>

        <Section title="Objectif hebdomadaire" icon="trending_up" id="goal-settings">
          <form
            noValidate
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(goalDraft);
              if (!Number.isInteger(n) || n < WEEKLY_GOAL_RANGE.min || n > WEEKLY_GOAL_RANGE.max) {
                setGoalError(`Saisissez un nombre entier de minutes entre ${WEEKLY_GOAL_RANGE.min} et ${WEEKLY_GOAL_RANGE.max}.`);
                return;
              }
              setGoalError(null);
              report(updatePreferences({ weeklyGoalMinutes: n }), `Objectif enregistré : ${n} minutes par semaine.`);
            }}
          >
            <label htmlFor={goalId} className="flex flex-col gap-1 font-label-md text-label-md text-on-surface-variant">
              Minutes de pratique par semaine
              <input
                id={goalId}
                type="number"
                inputMode="numeric"
                min={WEEKLY_GOAL_RANGE.min}
                max={WEEKLY_GOAL_RANGE.max}
                value={goalDraft}
                aria-invalid={goalError !== null}
                aria-describedby={goalError ? `${goalId}-error` : undefined}
                onChange={(e) => setGoalDraft(e.target.value)}
                className="h-12 w-32 rounded-2xl border border-mineral bg-surface-container-lowest px-3 font-label-lg text-label-lg focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </label>
            <button type="submit" className="min-h-[48px] rounded-full bg-primary-container px-5 font-label-lg text-label-lg text-on-primary hover:bg-secondary">
              Enregistrer l'objectif
            </button>
            {goalError ? (
              <p id={`${goalId}-error`} role="alert" className="w-full font-body-sm text-body-sm text-error">
                {goalError}
              </p>
            ) : null}
          </form>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Un repère bienveillant, sans série à maintenir ni culpabilité.</p>
        </Section>

        <Section title="Confidentialité" icon="privacy_tip" id="privacy-settings">
          <ul className="space-y-2 font-body-sm text-body-sm text-on-surface-variant">
            <li className="flex gap-2">
              <Icon name="lock" size={18} className="mt-0.5 shrink-0 text-secondary" />
              Aucun compte, aucune publicité, aucun envoi de données : tout reste dans le stockage local de ce navigateur.
            </li>
            <li className="flex gap-2">
              <Icon name="lock" size={18} className="mt-0.5 shrink-0 text-secondary" />
              Les observations de l'exercice 5-4-3-2-1 ne sont jamais enregistrées.
            </li>
          </ul>
          <Switch
            icon="history"
            label="Enregistrer mes séances dans Mon suivi"
            description="Désactivé : les séances terminées ne sont plus conservées (l'historique existant reste disponible)."
            checked={prefs.recordHistory}
            onChange={(v) => updatePreferences({ recordHistory: v })}
          />
        </Section>

        <Section title="Vos données" icon="download" id="data-settings">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {app.records.length} séance{app.records.length > 1 ? 's' : ''} enregistrée{app.records.length > 1 ? 's' : ''}.
          </p>
          <ExportButtons />
          <div className="space-y-2 border-t border-mineral pt-4">
            <label htmlFor={fileId} className="block font-label-lg text-label-lg text-primary">
              Importer une sauvegarde JSON
            </label>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Les séances importées s'ajoutent à votre historique, sans jamais le remplacer. Les doublons sont ignorés.</p>
            <input
              ref={fileRef}
              id={fileId}
              type="file"
              accept="application/json,.json"
              onChange={(e) => void onFile(e.target.files?.[0])}
              className="block w-full font-body-sm text-body-sm text-on-surface-variant file:mr-3 file:min-h-[44px] file:cursor-pointer file:rounded-full file:border-0 file:bg-surface-container-low file:px-4 file:font-label-lg file:text-primary"
            />
          </div>
          <div className="flex flex-col gap-2 border-t border-mineral pt-4 xs:flex-row">
            <button type="button" onClick={() => setConfirmClear(true)} className="flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-error-container px-4 font-label-lg text-label-lg text-on-error-container">
              <Icon name="delete" size={20} />
              Supprimer tout l'historique
            </button>
            <button type="button" onClick={() => setConfirmReset(true)} className="flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-surface-container-low px-4 font-label-lg text-label-lg text-primary">
              <Icon name="restart_alt" size={20} />
              Réinitialiser les préférences
            </button>
          </div>
        </Section>

        <SafetyNote>{SAFETY_NOTE}</SafetyNote>
      </div>

      <Dialog open={pendingImport !== null} onClose={() => setPendingImport(null)} title="Importer cette sauvegarde ?" icon="upload">
        {pendingImport ? (
          <div className="space-y-4">
            <ul className="space-y-1 font-body-sm text-body-sm text-on-surface">
              <li>Fichier : {pendingImport.fileName}</li>
              <li data-testid="import-new">
                {pendingImport.records.length - pendingImport.alreadyPresent} séance(s) seront ajoutées.
              </li>
              {pendingImport.alreadyPresent > 0 ? <li>{pendingImport.alreadyPresent} séance(s) déjà présentes seront ignorées.</li> : null}
              {pendingImport.duplicatesInFile > 0 ? <li>{pendingImport.duplicatesInFile} doublon(s) dans le fichier ignoré(s).</li> : null}
              {pendingImport.invalid > 0 ? <li>{pendingImport.invalid} entrée(s) invalide(s) ignorée(s).</li> : null}
            </ul>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Votre historique actuel est conservé.</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  const result = app.importRecords(pendingImport.records);
                  setPendingImport(null);
                  if (result.ok) setStatus({ tone: 'ok', text: `Import terminé : ${result.added} séance(s) ajoutée(s), ${result.duplicates} doublon(s) ignoré(s).` });
                  else setStatus({ tone: 'error', text: WRITE_ERROR_MESSAGES[result.error] });
                }}
                className="min-h-[48px] rounded-full bg-primary-container px-4 font-label-lg text-label-lg text-on-primary hover:bg-secondary"
              >
                Confirmer l'import
              </button>
              <button type="button" onClick={() => setPendingImport(null)} className="min-h-[48px] rounded-full bg-surface-container px-4 font-label-lg text-label-lg text-on-surface">
                Annuler
              </button>
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Supprimer tout l'historique ?"
        icon="delete"
        description="Toutes les séances enregistrées sur cet appareil seront définitivement supprimées, ainsi que les copies de sauvegarde internes. Pensez à exporter vos données avant. Cette action est irréversible."
      >
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setConfirmClear(false);
              report(app.clearHistory(), "L'historique a été supprimé.");
            }}
            className="min-h-[48px] rounded-full bg-error px-4 font-label-lg text-label-lg text-on-error"
          >
            Supprimer définitivement
          </button>
          <button type="button" onClick={() => setConfirmClear(false)} className="min-h-[48px] rounded-full bg-surface-container px-4 font-label-lg text-label-lg text-on-surface">
            Annuler
          </button>
        </div>
      </Dialog>

      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} title="Réinitialiser les préférences ?" icon="restart_alt" description="Sons, animations, objectif hebdomadaire et réglages des exercices reviendront à leurs valeurs par défaut. Votre historique n'est pas modifié.">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setConfirmReset(false);
              const result = app.resetPreferences();
              setGoalDraft('60');
              report(result, 'Préférences réinitialisées.');
            }}
            className="min-h-[48px] rounded-full bg-primary-container px-4 font-label-lg text-label-lg text-on-primary"
          >
            Réinitialiser
          </button>
          <button type="button" onClick={() => setConfirmReset(false)} className="min-h-[48px] rounded-full bg-surface-container px-4 font-label-lg text-label-lg text-on-surface">
            Annuler
          </button>
        </div>
      </Dialog>
    </PageLayout>
  );
}
