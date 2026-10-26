import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../app/AppData';
import { unlockAudio } from '../app/feedback';
import { useDocumentTitle } from '../app/hooks';
import { useSessionContext } from '../app/SessionContext';
import { normalizeConfig } from '../domain/config';
import { ALTERNATE_STEPS, BODY_SCAN_ZONES, GROUNDING_STEPS, PMR_GROUPS, WALKING_PROMPTS, findExercise, getCategory, type Exercise } from '../domain/exercises';
import { formatMinutesLabel } from '../domain/format';
import type { ExerciseConfig } from '../domain/types';
import { HUM_EXHALE_MS, HUM_INHALE_MS, SIGH_STEPS_MS, pacedPhases } from '../engine/plan';
import { isLive } from '../engine/session';
import { PageLayout } from '../layout/AppShell';
import { ConfigForm } from '../practice/ConfigForm';
import { phaseText } from '../practice/phaseText';
import { configSummary } from '../practice/ReadyView';
import { SafetyNote, Switch } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { NotFoundPage } from './NotFoundPage';

interface FlowItem {
  title: string;
  detail?: string;
  muted?: boolean;
}

function flowOf(exercise: Exercise, config: ExerciseConfig): { items: FlowItem[]; footer?: string } {
  switch (exercise.id) {
    case 'respiration-lente':
    case 'respiration-carree':
    case 'expiration-levres-pincees': {
      const phases = pacedPhases(exercise.id, config);
      const cycle = phases.reduce((s, p) => s + p.durationMs, 0) / 1000;
      return {
        items: phases.map((p) => ({ title: phaseText(exercise.id, p.key).badge, detail: `${p.durationMs / 1000} s — ${phaseText(exercise.id, p.key).note}` })),
        footer: `Cycle de ${cycle} s répété pendant ${formatMinutesLabel(config.durationSec)} (≈ ${Math.ceil(config.durationSec / cycle)} cycles).`,
      };
    }
    case 'expiration-fredonnement':
      return {
        items: config.autoPace
          ? [
              { title: 'Inspiration nasale douce', detail: `${HUM_INHALE_MS / 1000} s` },
              { title: 'Expiration en fredonnant « mmmm »', detail: `${HUM_EXHALE_MS / 1000} s` },
            ]
          : [{ title: 'Inspiration puis fredonnement à votre rythme', detail: 'Validez chaque répétition' }],
        footer: `${config.repetitions} répétitions.`,
      };
    case 'soupir-physiologique':
      return {
        items: [
          { title: 'Inspiration par le nez', detail: config.autoPace ? `${SIGH_STEPS_MS.inhale1 / 1000} s` : 'À votre rythme' },
          ...(config.secondInhale ? [{ title: 'Petite inspiration d’appoint', detail: config.autoPace ? `${String(SIGH_STEPS_MS.inhale2 / 1000).replace('.', ',')} s` : 'À votre rythme' }] : []),
          { title: 'Longue expiration relâchée', detail: config.autoPace ? `${SIGH_STEPS_MS.exhale / 1000} s` : 'À votre rythme' },
        ],
        footer: `${config.repetitions} répétition${config.repetitions > 1 ? 's' : ''}.`,
      };
    case 'respiration-alternee':
      return { items: ALTERNATE_STEPS.map((s) => ({ title: s.title, detail: s.finger })), footer: 'Ces quatre étapes forment un cycle.' };
    case 'relaxation-musculaire':
      return {
        items: PMR_GROUPS.map((g) => ({ title: g.title, detail: config.excludedUnits.includes(g.key) ? 'Zone passée' : g.instruction, muted: config.excludedUnits.includes(g.key) })),
        footer: 'Chaque zone : contraction très douce 5 s, relâchement 10 s, puis un temps d’observation.',
      };
    case 'scan-corporel':
      return { items: BODY_SCAN_ZONES.map((z) => ({ title: z.title, detail: z.instruction })), footer: `Environ ${Math.round(config.durationSec / 8)} s par zone.` };
    case 'marche-attentive':
      return { items: WALKING_PROMPTS.map((p) => ({ title: p.title })), footer: 'Une nouvelle invite environ toutes les 90 secondes. Respiration libre.' };
    case 'ancrage-sensoriel':
      return { items: GROUNDING_STEPS.map((s) => ({ title: s.title, detail: s.sense })), footer: 'Aucun compte à rebours : avancez à votre rythme.' };
    default:
      return { items: [] };
  }
}

export function ExerciseDetailPage() {
  const { exerciseId } = useParams();
  const exercise = findExercise(exerciseId);
  if (!exercise) return <NotFoundPage />;
  return <ExerciseDetail key={exercise.id} exercise={exercise} />;
}

function ExerciseDetail({ exercise }: { exercise: Exercise }) {
  useDocumentTitle(exercise.title);
  const navigate = useNavigate();
  const { preferences, updatePreferences } = useAppData();
  const { session, begin } = useSessionContext();
  const [config, setConfig] = useState<ExerciseConfig>(() => normalizeConfig(exercise, preferences.exerciseConfigs[exercise.id] ?? exercise.defaults));
  const category = getCategory(exercise.category);
  const summary = configSummary(exercise, config);
  const flow = flowOf(exercise, config);
  const otherLive = session && isLive(session) && session.exerciseId !== exercise.id;

  const save = (next: ExerciseConfig) => {
    setConfig(next);
    updatePreferences({ exerciseConfigs: { ...preferences.exerciseConfigs, [exercise.id]: next } });
  };

  const start = () => {
    save(config);
    if (!otherLive) {
      unlockAudio();
      begin(exercise.id, config);
    }
    navigate(`/pratique/${exercise.id}`);
  };

  return (
    <PageLayout variant="sub" title="Détail Exercice" backTo="/exercices" backLabel="Retour aux exercices">
      <div className="flex w-full flex-col space-y-6 pb-10">
        <section className="on-dark relative w-full overflow-hidden rounded-2xl bg-primary p-6 text-on-primary shadow-md" aria-labelledby="detail-title">
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-44 w-44 rounded-full bg-secondary/20 blur-2xl" />
          <div className="relative z-10 flex flex-col space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1 font-label-md text-label-md text-on-secondary-container">
                <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                {category.label}
              </span>
              <span className="flex items-center gap-1 font-label-sm text-label-sm text-inverse-primary">
                <Icon name="schedule" size={16} />
                {summary.duration}
              </span>
            </div>
            <div>
              <h2 id="detail-title" className="font-headline-md text-headline-md font-semibold tracking-tight text-on-primary">
                {exercise.title}
              </h2>
              <p className="mt-1 font-body-sm text-body-sm text-on-primary/85">{exercise.summary}</p>
            </div>
            <ul className="flex flex-wrap gap-2 pt-2">
              {[{ icon: 'verified_user' as const, label: 'Sans forcer' }, ...exercise.tags].map((tag) => (
                <li key={tag.label} className="inline-flex items-center gap-1 rounded-full bg-primary-container px-2.5 py-1 font-label-sm text-label-sm text-on-primary">
                  <Icon name={tag.icon} size={15} className="text-secondary-fixed" />
                  {tag.label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl bg-surface-container-lowest p-5 shadow-sm" aria-labelledby="howto-title">
          <h3 id="howto-title" className="flex items-center gap-2 font-headline-sm text-headline-sm text-on-surface">
            <Icon name="lightbulb" size={22} className="text-secondary" />
            Comment pratiquer
          </h3>
          <p className="font-body-md text-body-md leading-relaxed text-on-surface-variant" data-testid="instructions">
            {exercise.instructions}
          </p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            <span className="font-semibold text-primary">Bienfaits recherchés : </span>
            {exercise.benefits}
          </p>
        </section>

        <section className="space-y-5 rounded-2xl bg-surface-container-lowest p-5 shadow-sm" aria-labelledby="config-title">
          <div className="flex items-center justify-between">
            <h3 id="config-title" className="flex items-center gap-2 font-headline-sm text-headline-sm text-on-surface">
              <Icon name="tune" size={22} className="text-secondary" />
              Configuration de séance
            </h3>
            <span className="font-label-sm text-label-sm text-on-surface-variant">Personnalisable</span>
          </div>
          <ConfigForm exercise={exercise} config={config} onChange={save} />
          <Switch
            icon="volume_up"
            label="Guidage audio & carillon doux"
            description="Signaux sonores calmes aux transitions, pour fermer les yeux sereinement."
            checked={preferences.sound}
            onChange={(v) => updatePreferences({ sound: v })}
          />
        </section>

        <section className="space-y-4 rounded-2xl bg-surface-container-lowest p-5 shadow-sm" aria-labelledby="flow-title">
          <div className="flex items-center justify-between">
            <h3 id="flow-title" className="flex items-center gap-2 font-headline-sm text-headline-sm text-on-surface">
              <Icon name="accessibility_new" size={22} className="text-secondary" />
              Aperçu guidé du flux
            </h3>
            <span className="font-label-sm text-label-sm font-medium text-secondary">{flow.items.length} étapes</span>
          </div>
          <ol className="space-y-2">
            {flow.items.map((item, index) => (
              <li key={`${item.title}-${index}`} className={`flex gap-3 rounded-xl bg-surface-container-low p-3 ${item.muted ? 'opacity-60' : ''}`}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest font-label-md text-label-md font-bold text-primary shadow-sm">{index + 1}</span>
                <span className="min-w-0">
                  <span className={`block font-label-lg text-label-lg text-on-surface ${item.muted ? 'line-through' : ''}`}>{item.title}</span>
                  {item.detail ? <span className="block font-body-sm text-body-sm text-on-surface-variant">{item.detail}</span> : null}
                </span>
              </li>
            ))}
          </ol>
          {flow.footer ? <p className="font-body-sm text-body-sm text-on-surface-variant">{flow.footer}</p> : null}
        </section>

        {exercise.id === 'relaxation-musculaire' || exercise.id === 'scan-corporel' ? (
          <Link to="/exercices/ancrage-sensoriel" className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container-high p-4 shadow-sm hover:bg-surface-container-highest">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-bright text-primary">
                <Icon name="spa" size={20} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-label-lg text-label-lg font-semibold text-on-surface">Option d'ancrage 5-4-3-2-1</span>
                <span className="block truncate font-body-sm text-body-sm text-on-surface-variant">Pour prolonger en fin de séance</span>
              </span>
            </span>
            <Icon name="chevron_right" size={20} className="text-primary" />
          </Link>
        ) : null}

        <SafetyNote title="Conseils et sécurité corporelle">{exercise.safety}</SafetyNote>

        <div className="pt-2">
          {otherLive ? (
            <p role="status" className="mb-2 rounded-xl bg-secondary-container/40 p-3 font-body-sm text-body-sm text-on-surface">
              Une autre séance est en pause : vous pourrez choisir de la reprendre ou de l’abandonner.
            </p>
          ) : null}
          <button
            type="button"
            onClick={start}
            className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-primary font-label-lg text-label-lg font-semibold text-on-primary shadow-md transition-all hover:bg-secondary active:scale-[0.98]"
          >
            <Icon name="play_arrow" size={22} filled />
            Démarrer la séance guidée
          </button>
          <p className="mt-2.5 text-center font-label-sm text-label-sm text-on-surface-variant">Séance adaptable et interruptible à tout moment d'un simple geste.</p>
        </div>
      </div>
    </PageLayout>
  );
}
