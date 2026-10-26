import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAppData } from '../app/AppData';
import { chime, speak, stopSpeaking, unlockAudio, vibrate } from '../app/feedback';
import { DESKTOP_QUERY, useDocumentTitle, useMediaQuery, useNow, useReducedMotion } from '../app/hooks';
import { useSessionContext } from '../app/SessionContext';
import { normalizeConfig } from '../domain/config';
import { findExercise, getExercise, type Exercise } from '../domain/exercises';
import { formatDuration } from '../domain/format';
import { ROUTINE_ID, nextRoutineStep, routineStepFor } from '../domain/routine';
import type { ExerciseConfig, ExerciseId } from '../domain/types';
import { MIN_PARTIAL_RECORD_SECONDS, activeMsAt, finishEarly, isEnded, isLive, pause, resume, tick, type Session } from '../engine/session';
import { PageLayout } from '../layout/AppShell';
import { applyConfigToSession } from '../practice/applyConfig';
import { ConfigForm } from '../practice/ConfigForm';
import { describeMoment } from '../practice/moment';
import { ReadyView } from '../practice/ReadyView';
import { SummaryView } from '../practice/SummaryView';
import type { PracticeApi } from '../practice/types';
import { AlternateView } from '../practice/views/AlternateView';
import { BodyScanView } from '../practice/views/BodyScanView';
import { BoxBreathingView } from '../practice/views/BoxBreathingView';
import { GroundingView } from '../practice/views/GroundingView';
import { HummingView } from '../practice/views/HummingView';
import { PmrView } from '../practice/views/PmrView';
import { PursedLipView } from '../practice/views/PursedLipView';
import { SighView } from '../practice/views/SighView';
import { SlowBreathingView } from '../practice/views/SlowBreathingView';
import { WalkingView } from '../practice/views/WalkingView';
import type { Preferences } from '../storage/preferences';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { NotFoundPage } from './NotFoundPage';

const VIEWS: Record<ExerciseId, ComponentType<{ api: PracticeApi }>> = {
  'respiration-lente': SlowBreathingView,
  'respiration-carree': BoxBreathingView,
  'expiration-levres-pincees': PursedLipView,
  'expiration-fredonnement': HummingView,
  'respiration-alternee': AlternateView,
  'soupir-physiologique': SighView,
  'relaxation-musculaire': PmrView,
  'scan-corporel': BodyScanView,
  'marche-attentive': WalkingView,
  'ancrage-sensoriel': GroundingView,
};

const INTERACTIVE = 'button, a, input, select, textarea, [role="switch"], [role="button"], [contenteditable="true"]';

export function PracticePage() {
  const { exerciseId } = useParams();
  const exercise = findExercise(exerciseId);
  if (!exercise) return <NotFoundPage />;
  return <PracticeScreen key={exercise.id} exercise={exercise} />;
}

function PracticeScreen({ exercise }: { exercise: Exercise }) {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const inRoutine = search.get('routine') === ROUTINE_ID;
  const routine = inRoutine ? routineStepFor(exercise.id) : null;
  const { preferences, updatePreferences } = useAppData();
  const ctx = useSessionContext();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const reducedMotion = useReducedMotion();
  useDocumentTitle(exercise.title);

  const own = ctx.session && ctx.session.exerciseId === exercise.id && ctx.session.status !== 'cancelled' ? ctx.session : null;
  const other = ctx.session && ctx.session.exerciseId !== exercise.id && isLive(ctx.session) ? ctx.session : null;
  const running = own?.status === 'running';
  const now = useNow(running);

  const savedConfig = preferences.exerciseConfigs[exercise.id];
  const [setupConfig, setSetupConfig] = useState<ExerciseConfig>(() => routine?.config ?? normalizeConfig(exercise, savedConfig ?? exercise.defaults));

  const [finishOpen, setFinishOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [settings, setSettings] = useState<{ draft: ExerciseConfig; resumeAfter: boolean } | null>(null);
  const [settingsNote, setSettingsNote] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const { act, checkpoint } = ctx;

  // Bring the live session up to date (auto-advance / completion) and checkpoint it periodically.
  useEffect(() => {
    if (!running) return;
    act(tick);
    checkpoint();
  }, [now, running, act, checkpoint]);

  // Stop speech when leaving the screen.
  useEffect(() => () => stopSpeaking(), []);

  const view: Session | null = own ? (isLive(own) ? tick(own, now) : own) : null;
  const live = view !== null && isLive(view);

  // Cues & screen-reader announcements on phase / step changes only.
  const moment = live && view ? describeMoment(view, now) : null;
  const momentKey = moment?.key ?? null;
  const lastKey = useRef<string | null>(null);
  const prefsRef = useRef<Preferences>(preferences);
  prefsRef.current = preferences;
  useEffect(() => {
    if (!momentKey || !moment) {
      lastKey.current = null;
      return;
    }
    if (lastKey.current === momentKey) return;
    lastKey.current = momentKey;
    if (moment.announce) setAnnouncement(moment.announce);
    if (!running) return;
    const prefs = prefsRef.current;
    if (prefs.sound) chime(prefs.soundTimbre, prefs.volume);
    if (prefs.haptics) vibrate(40);
    if (prefs.voice && moment.speech) speak(moment.speech);
    // `moment` is derived from momentKey; listing it would re-run every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [momentKey, running]);

  // Completion cue + focus the summary heading.
  const ended = own ? isEnded(own) : false;
  useEffect(() => {
    if (!ended) return;
    setFinishOpen(false);
    setSettings(null);
    setAnnouncement('Séance terminée');
    const prefs = prefsRef.current;
    if (prefs.sound) chime(prefs.soundTimbre, prefs.volume, 'low');
    if (prefs.haptics) vibrate([60, 80, 60]);
    // Effects run after commit, so the summary heading already exists.
    document.getElementById('summary-title')?.focus();
  }, [ended]);

  const startSession = useCallback(
    (config: ExerciseConfig) => {
      unlockAudio();
      if (!inRoutine) updatePreferences({ exerciseConfigs: { ...preferences.exerciseConfigs, [exercise.id]: config } });
      ctx.begin(exercise.id, config);
      window.scrollTo(0, 0);
    },
    [ctx, exercise.id, inRoutine, preferences.exerciseConfigs, updatePreferences],
  );

  const applyConfig = useCallback(
    (config: ExerciseConfig) => {
      let applied = false;
      act((s, at) => {
        const result = applyConfigToSession(s, config, at);
        applied = result.applied;
        return result.session;
      });
      if (!inRoutine) updatePreferences({ exerciseConfigs: { ...preferences.exerciseConfigs, [exercise.id]: config } });
      return { applied };
    },
    [act, exercise.id, inRoutine, preferences.exerciseConfigs, updatePreferences],
  );

  const api: PracticeApi | null = useMemo(() => {
    if (!view || !isLive(view)) return null;
    return {
      exercise,
      session: view,
      now,
      activeMs: activeMsAt(view, now),
      running: view.status === 'running',
      paused: view.status === 'paused',
      reducedMotion,
      desktop,
      preferences,
      setPreferences: updatePreferences,
      act: (fn) => {
        act(fn);
      },
      pause: () => act(pause),
      resume: () => {
        unlockAudio();
        act(resume);
      },
      togglePause: () => {
        unlockAudio();
        act((s, at) => (s.status === 'running' ? pause(s, at) : resume(s, at)));
      },
      requestFinish: () => setFinishOpen(true),
      requestRestart: () => setRestartOpen(true),
      openSettings: () => {
        const wasRunning = view.status === 'running';
        if (wasRunning) act(pause);
        setSettingsNote(null);
        setSettings({ draft: view.config, resumeAfter: wasRunning });
      },
      applyConfig,
    };
  }, [view, now, exercise, reducedMotion, desktop, preferences, updatePreferences, act, applyConfig]);

  // Space toggles pause/resume (when focus is not on a control and no dialog is open).
  const dialogOpen = finishOpen || restartOpen || abandonOpen || settings !== null;
  useEffect(() => {
    if (!live) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return;
      if (dialogOpen || event.repeat) return;
      const target = event.target;
      if (target instanceof Element && target.closest(INTERACTIVE)) return;
      event.preventDefault();
      act((s, at) => (s.status === 'running' ? pause(s, at) : resume(s, at)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [live, dialogOpen, act]);

  const LiveView = VIEWS[exercise.id];
  const activeSecondsNow = view ? Math.floor(activeMsAt(view, now) / 1000) : 0;
  const nextRoutine = inRoutine ? nextRoutineStep(exercise.id) : null;

  const leave = (to: string) => {
    ctx.discard();
    navigate(to);
  };

  let content;
  if (view && isLive(view) && api) {
    content = (
      <>
        {ctx.restored && view.status === 'paused' ? (
          <div role="status" className="mb-space-md flex items-start gap-2 rounded-2xl bg-surface-container-high p-3">
            <Icon name="history" size={20} className="mt-0.5 text-secondary" />
            <p className="font-body-sm text-body-sm text-on-surface">
              Séance restaurée et mise en pause après le rechargement de la page. Seul le temps pratiqué avant l’interruption est comptabilisé.
            </p>
          </div>
        ) : null}
        {settingsNote ? (
          <div role="status" className="mb-space-md flex items-start justify-between gap-2 rounded-2xl bg-surface-container-high p-3">
            <p className="font-body-sm text-body-sm text-on-surface">{settingsNote}</p>
            <button type="button" aria-label="Fermer le message" onClick={() => setSettingsNote(null)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-container">
              <Icon name="close" size={18} />
            </button>
          </div>
        ) : null}
        <LiveView api={api} />
      </>
    );
  } else if (view && isEnded(view)) {
    content = (
      <SummaryView
        exercise={exercise}
        session={view}
        saveState={ctx.saveState}
        saveError={ctx.saveError}
        feeling={ctx.feeling}
        onFeeling={ctx.setFeeling}
        onRetry={ctx.retrySave}
        onRestart={() => startSession(view.config)}
        onLeave={leave}
        nextRoutine={nextRoutine}
      />
    );
  } else {
    content = (
      <div className="flex flex-col gap-space-md">
        {other ? (
          <div role="status" className="flex flex-col gap-2 rounded-2xl bg-secondary-container/40 p-4">
            <p className="font-body-sm text-body-sm text-on-surface">
              Une séance de <strong>{getExercise(other.exerciseId).title}</strong> est en pause.
            </p>
            <button
              type="button"
              onClick={() => navigate(`/pratique/${other.exerciseId}`)}
              className="flex min-h-[44px] items-center justify-center gap-1 self-start rounded-full bg-primary-container px-4 font-label-lg text-label-lg text-on-primary"
            >
              <Icon name="play_arrow" size={18} filled />
              Reprendre cette séance
            </button>
          </div>
        ) : null}
        <ReadyView
          exercise={exercise}
          config={setupConfig}
          onConfigChange={setSetupConfig}
          preferences={preferences}
          routine={routine}
          onStart={() => (other ? setAbandonOpen(true) : startSession(setupConfig))}
        />
      </div>
    );
  }

  return (
    <PageLayout variant="sub" title="Pratique" backTo="/exercices" backLabel="Retour aux exercices" wide={desktop && exercise.id === 'respiration-carree' && live}>
      <p className="sr-only" aria-live="polite" aria-atomic="true" data-testid="announcer">
        {announcement}
      </p>
      {content}

      <Dialog
        open={finishOpen && live}
        onClose={() => setFinishOpen(false)}
        title="Terminer la séance maintenant ?"
        icon="flag"
        description={
          activeSecondsNow >= MIN_PARTIAL_RECORD_SECONDS
            ? `Vous avez pratiqué ${formatDuration(activeSecondsNow)}. La séance sera enregistrée comme « terminée plus tôt ».`
            : 'Moins de 5 secondes de pratique : aucune séance ne sera enregistrée.'
        }
      >
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setFinishOpen(false);
              act(finishEarly);
            }}
            className="min-h-[48px] rounded-full bg-primary-container px-4 font-label-lg text-label-lg text-on-primary hover:bg-secondary"
          >
            {activeSecondsNow >= MIN_PARTIAL_RECORD_SECONDS ? 'Terminer et enregistrer' : 'Terminer'}
          </button>
          <button
            type="button"
            onClick={() => {
              setFinishOpen(false);
              ctx.discard();
            }}
            className="min-h-[48px] rounded-full bg-surface-container px-4 font-label-lg text-label-lg text-error hover:bg-error-container hover:text-on-error-container"
          >
            Abandonner sans enregistrer
          </button>
          <button type="button" onClick={() => setFinishOpen(false)} className="min-h-[48px] rounded-full px-4 font-label-lg text-label-lg text-on-surface-variant hover:text-primary">
            Continuer la pratique
          </button>
        </div>
      </Dialog>

      <Dialog
        open={restartOpen && live}
        onClose={() => setRestartOpen(false)}
        title="Recommencer depuis le début ?"
        icon="replay"
        description="La progression de cette séance ne sera pas enregistrée."
      >
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setRestartOpen(false);
              if (own) startSession(own.config);
            }}
            className="min-h-[48px] rounded-full bg-primary-container px-4 font-label-lg text-label-lg text-on-primary hover:bg-secondary"
          >
            Recommencer
          </button>
          <button type="button" onClick={() => setRestartOpen(false)} className="min-h-[48px] rounded-full bg-surface-container px-4 font-label-lg text-label-lg text-on-surface">
            Continuer la séance
          </button>
        </div>
      </Dialog>

      <Dialog
        open={abandonOpen}
        onClose={() => setAbandonOpen(false)}
        title="Une autre séance est en pause"
        icon="pause_circle"
        description={other ? `Commencer « ${exercise.title} » abandonnera la séance en pause de « ${getExercise(other.exerciseId).title} » sans l’enregistrer.` : undefined}
      >
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setAbandonOpen(false);
              ctx.discard();
              startSession(setupConfig);
            }}
            className="min-h-[48px] rounded-full bg-primary-container px-4 font-label-lg text-label-lg text-on-primary hover:bg-secondary"
          >
            Abandonner et commencer
          </button>
          <button type="button" onClick={() => setAbandonOpen(false)} className="min-h-[48px] rounded-full bg-surface-container px-4 font-label-lg text-label-lg text-on-surface">
            Annuler
          </button>
        </div>
      </Dialog>

      <Dialog
        open={settings !== null && live}
        onClose={() => {
          if (settings?.resumeAfter) act(resume);
          setSettings(null);
        }}
        title="Réglages de la séance"
        icon="tune"
        description="La séance est en pause pendant vos réglages."
        showClose
      >
        {settings && view ? (
          <div className="space-y-5">
            <ConfigForm
              exercise={exercise}
              config={settings.draft}
              inSession
              minDurationSec={Math.floor(activeMsAt(view, now) / 1000)}
              lockedUnits={
                view.family === 'sequence'
                  ? view.unitKeys.filter((_, u) => u <= (view.steps[view.stepIndex]?.unit ?? 0))
                  : []
              }
              onChange={(draft) => setSettings({ ...settings, draft })}
            />
            <button
              type="button"
              onClick={() => {
                const { applied } = applyConfig(settings.draft);
                if (!applied) {
                  setSettingsNote('Certains réglages ne peuvent pas modifier la séance en cours : ils sont enregistrés pour la prochaine séance.');
                }
                if (settings.resumeAfter) act(resume);
                setSettings(null);
              }}
              className="min-h-[52px] w-full rounded-full bg-primary-container font-label-lg text-label-lg font-semibold text-on-primary shadow-sm hover:bg-primary"
            >
              {settings.resumeAfter ? 'Appliquer et reprendre' : 'Appliquer'}
            </button>
          </div>
        ) : null}
      </Dialog>
    </PageLayout>
  );
}
