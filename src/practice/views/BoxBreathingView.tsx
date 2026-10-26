import { Link } from 'react-router-dom';
import { normalizeConfig } from '../../domain/config';
import { formatClock, formatRemaining, phaseSeconds } from '../../domain/format';
import type { PhaseKey } from '../../domain/types';
import { phaseAt, plannedCycles, type PhaseInfo, type TimeboxedSession } from '../../engine/session';
import { ChoiceGroup, Stepper, Switch } from '../../ui/controls';
import { Icon } from '../../ui/Icon';
import { phaseText } from '../phaseText';
import { PausedBanner, ProgressBar, SensoryToggles, breathScale } from '../shared';
import type { PracticeApi } from '../types';

const SIDES: Record<PhaseKey, { d: string; label: string; index: number }> = {
  inhale: { d: 'M 62 25 L 218 25', label: '1. Inspirez', index: 0 },
  'hold-in': { d: 'M 255 62 L 255 218', label: '2. Pause', index: 1 },
  exhale: { d: 'M 218 255 L 62 255', label: '3. Expirez', index: 2 },
  'hold-out': { d: 'M 25 218 L 25 62', label: '4. Pause', index: 3 },
};
const SIDE_LENGTH = 156;

function Squircle({ info, api, large }: { info: PhaseInfo; api: PracticeApi; large: boolean }) {
  const text = phaseText('respiration-carree', info.phase.key);
  const progress = info.phaseElapsedMs / info.phase.durationMs;
  const scale = breathScale(info.phase.key, progress, api.reducedMotion, 0.9, 1.12);
  const enabled = new Set(info.segment.phases.map((p) => p.key));
  return (
    <div
      className={`relative mx-auto flex aspect-square w-full items-center justify-center p-3 ${large ? 'max-w-[360px]' : 'max-w-[340px]'}`}
      data-testid="breath-visual"
      data-phase={info.phase.key}
      data-scale={scale.toFixed(3)}
    >
      <div className="breath-transition absolute inset-8 rounded-3xl bg-secondary-fixed opacity-30 blur-2xl" style={{ transform: `scale(${scale})` }} />
      <svg className="relative z-10 h-full w-full" fill="none" viewBox="0 0 280 280" aria-hidden="true">
        <rect height="230" rx="36" stroke="#e3f2ee" strokeWidth="8" width="230" x="25" y="25" />
        {(Object.keys(SIDES) as PhaseKey[]).map((key) => (
          <path key={key} d={SIDES[key].d} stroke={enabled.has(key) ? '#dfe7e6' : '#eef2f1'} strokeLinecap="round" strokeWidth="8" />
        ))}
        <path
          d={SIDES[info.phase.key].d}
          stroke="#146a5f"
          strokeLinecap="round"
          strokeWidth="10"
          strokeDasharray={`${SIDE_LENGTH} ${SIDE_LENGTH}`}
          strokeDashoffset={api.reducedMotion ? 0 : SIDE_LENGTH * (1 - progress)}
          className="breath-transition"
          data-testid="active-side"
        />
        {[
          [25, 25],
          [255, 25],
          [255, 255],
          [25, 255],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} fill="#a2eee0" opacity="0.6" r="4" />
        ))}
      </svg>
      {large ? (
        <>
          {(Object.keys(SIDES) as PhaseKey[]).map((key) => {
            const pos =
              key === 'inhale'
                ? '-top-1 left-1/2 -translate-x-1/2'
                : key === 'exhale'
                  ? '-bottom-1 left-1/2 -translate-x-1/2'
                  : key === 'hold-in'
                    ? '-right-4 top-1/2 -translate-y-1/2 rotate-90'
                    : '-left-4 top-1/2 -translate-y-1/2 -rotate-90';
            return (
              <span
                key={key}
                aria-hidden="true"
                className={`absolute z-20 flex items-center gap-1 rounded-full bg-surface-container-lowest px-space-sm py-0.5 font-label-sm text-label-sm shadow-sm ${pos} ${
                  enabled.has(key) ? 'text-on-surface-variant' : 'text-outline-variant line-through'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${info.phase.key === key ? 'bg-secondary' : 'bg-outline-variant'}`} />
                {SIDES[key].label}
              </span>
            );
          })}
        </>
      ) : null}
      <div className="pointer-events-none absolute inset-0 z-20 flex select-none flex-col items-center justify-center p-6 text-center">
        <div className="mb-1 flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1 text-on-secondary-container shadow-sm">
          <Icon name="air" size={15} filled />
          <span className="font-label-md text-label-md font-semibold" data-testid="phase-badge">
            {text.badge}
          </span>
        </div>
        <div className="my-0.5 flex items-baseline gap-0.5" aria-hidden="true">
          <span className={`font-light tracking-tighter text-primary tabular-nums ${large ? 'font-timer-display text-timer-display' : 'font-timer-display-mobile text-timer-display-mobile'}`} data-testid="phase-count">
            {phaseSeconds(info.phaseRemainingMs)}
          </span>
          <span className="font-label-lg text-label-lg font-medium text-on-surface-variant">s</span>
        </div>
        <p className="font-headline-sm text-headline-sm font-medium tracking-tight text-primary">{text.title}</p>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{text.note}</p>
      </div>
    </div>
  );
}

function HoldsBanner({ api, session }: { api: PracticeApi; session: TimeboxedSession }) {
  const holdsOn = session.config.holdInEnabled || session.config.holdOutEnabled;
  return (
    <div className="flex items-center justify-between gap-2 rounded bg-surface-container-lowest p-3.5 shadow-sm">
      <div className="flex items-center gap-3 pr-2">
        <Icon name="filter_vintage" size={22} filled className="text-secondary" />
        <div className="flex flex-col">
          <span className="font-label-md text-label-md font-semibold text-primary">Rythme sans apnée forcée</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            {holdsOn
              ? `Pauses actives (${session.config.holdInSec}s / ${session.config.holdOutSec}s) — elles s'appliquent au prochain cycle`
              : 'Pauses désactivées par défaut pour une fluidité sans tension'}
          </span>
        </div>
      </div>
      <button
        type="button"
        aria-pressed={holdsOn}
        onClick={() =>
          api.applyConfig(normalizeConfig('respiration-carree', { ...session.config, holdInEnabled: !holdsOn, holdOutEnabled: !holdsOn }))
        }
        className={`min-h-[44px] shrink-0 rounded-full px-3 py-1.5 font-label-md text-label-md font-semibold transition-transform active:scale-95 ${
          holdsOn ? 'bg-secondary text-on-secondary' : 'bg-surface-container-low text-secondary'
        }`}
      >
        {holdsOn ? 'Désactiver les pauses' : 'Activer pauses'}
      </button>
    </div>
  );
}

function DesktopCustomization({ api, session }: { api: PracticeApi; session: TimeboxedSession }) {
  const config = session.config;
  const apply = (patch: Partial<typeof config>) => api.applyConfig(normalizeConfig('respiration-carree', { ...config, ...patch }));
  const active = Math.min(api.activeMs, session.targetMs);
  return (
    <aside className="flex flex-col gap-space-lg lg:col-span-4" aria-label="Personnalisation">
      <div className="flex flex-col gap-space-md rounded-lg bg-surface-container-lowest p-space-lg shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-space-xs font-headline-sm text-headline-sm font-bold text-primary">
            <Icon name="tune" size={22} className="text-secondary" />
            Personnalisation
          </h3>
          <button
            type="button"
            onClick={() => api.applyConfig({ ...api.exercise.defaults, durationSec: config.durationSec })}
            className="min-h-[44px] px-2 font-label-sm text-label-sm text-on-surface-variant underline hover:text-primary"
          >
            Cadence par défaut
          </button>
        </div>
        <Stepper label="1. Inspiration" description="Gonflez le ventre sans forcer" value={config.inhaleSec} min={2} max={8} format={(v) => `${v}s`} onChange={(v) => apply({ inhaleSec: v })} />
        <Switch label={`2. Rétention haute (${config.holdInSec}s)`} description="Pause confortable. Aucune obligation de retenir son souffle." checked={config.holdInEnabled} onChange={(v) => apply({ holdInEnabled: v })} />
        <Stepper label="3. Expiration" description="Laissez retomber l'air tiède" value={config.exhaleSec} min={2} max={8} format={(v) => `${v}s`} onChange={(v) => apply({ exhaleSec: v })} />
        <Switch label={`4. Rétention basse (${config.holdOutSec}s)`} description="Désactivable, pour une détente continue." checked={config.holdOutEnabled} onChange={(v) => apply({ holdOutEnabled: v })} />
        <ChoiceGroup<number>
          label="Durée de la séance"
          value={config.durationSec}
          options={(api.exercise.options.durations ?? []).map((sec) => ({
            value: sec,
            label: sec === api.exercise.defaults.durationSec ? `${sec / 60} min (idéal)` : `${sec / 60} min`,
            disabled: sec * 1000 <= active + 1000,
          }))}
          onChange={(v) => apply({ durationSec: v })}
        />
        <p className="font-label-sm text-label-sm text-on-surface-variant">Les changements de cadence s'appliquent au début du cycle suivant.</p>
      </div>
      <div className="flex flex-col gap-space-md rounded-lg bg-surface-container-lowest p-space-lg shadow-sm">
        <h3 className="flex items-center gap-space-xs font-headline-sm text-headline-sm font-bold text-primary">
          <Icon name="notifications_active" size={22} className="text-secondary" />
          Sons &amp; Sensations
        </h3>
        <Switch label="Cloche douce" description="Carillon aux transitions" checked={api.preferences.sound} onChange={(v) => api.setPreferences({ sound: v })} />
        <Switch label="Retour haptique" description="Vibration courte (appareils compatibles)" checked={api.preferences.haptics} onChange={(v) => api.setPreferences({ haptics: v })} />
        <label className="flex flex-col gap-1 pt-1">
          <span className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
            <span>Volume du guide</span>
            <span className="font-semibold text-primary">{api.preferences.volume}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={api.preferences.volume}
            onChange={(event) => api.setPreferences({ volume: Number(event.target.value) })}
            className="h-1.5 w-full cursor-pointer accent-secondary"
            aria-label="Volume du guide"
          />
        </label>
      </div>
      <div className="flex flex-col gap-space-sm rounded-lg bg-surface-container-low p-space-lg shadow-sm">
        <span className="flex items-center gap-space-xs font-label-lg text-label-lg font-bold text-secondary">
          <Icon name="health_and_safety" size={20} />
          Bienveillance &amp; Sécurité
        </span>
        <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">{api.exercise.safety}</p>
      </div>
    </aside>
  );
}

export function BoxBreathingView({ api }: { api: PracticeApi }) {
  const session = api.session as TimeboxedSession;
  const active = Math.min(api.activeMs, session.targetMs);
  const info = phaseAt(session.segments, active);
  const total = plannedCycles(session);
  const cycle = Math.min(total, info.cycleIndex + 1);
  const remaining = session.targetMs - active;

  if (api.desktop) {
    const phaseNumber = SIDES[info.phase.key].index + 1;
    return (
      <div className="w-full pb-space-xl">
        <div className="flex flex-wrap items-center justify-between gap-space-md py-space-md">
          <nav aria-label="Fil d'Ariane" className="flex items-center gap-space-sm font-label-md text-label-md text-on-surface-variant">
            <Link to="/exercices" className="hover:text-primary">
              Exercices
            </Link>
            <span className="text-outline-variant" aria-hidden="true">
              /
            </span>
            <span className="font-semibold text-primary" aria-current="page">
              {api.exercise.title}
            </span>
          </nav>
          <div className="flex items-center gap-space-xs rounded-full bg-surface-container-low px-space-md py-space-xs shadow-sm">
            <span className={`h-2 w-2 rounded-full ${api.running ? 'animate-pulse bg-secondary' : 'bg-outline'}`} />
            <span className="font-label-md text-label-md font-semibold text-primary">{api.running ? 'En cours' : 'En pause'}</span>
            <span className="mx-space-xs text-outline-variant" aria-hidden="true">
              •
            </span>
            <span className="font-label-md text-label-md text-on-surface-variant tabular-nums">
              {formatClock(active)} / {formatClock(session.targetMs)}
            </span>
          </div>
        </div>
        <div className="mt-space-sm grid grid-cols-1 items-start gap-gutter-lg lg:grid-cols-12">
          <section className="flex flex-col gap-space-lg lg:col-span-8" aria-labelledby="box-title">
            <div className="flex flex-col gap-space-xs">
              <div className="flex items-center gap-space-sm">
                <span className="rounded-full bg-secondary-container px-space-sm py-0.5 font-label-sm text-label-sm font-semibold uppercase tracking-wide text-on-secondary-container">
                  {api.exercise.eyebrow}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  • Rythme {info.segment.phases.map((p) => p.durationMs / 1000).join('-')} paramétrable
                </span>
              </div>
              <h2 id="box-title" className="font-headline-lg text-headline-lg font-bold tracking-tight text-primary">
                {api.exercise.title}
              </h2>
              <p className="max-w-2xl font-body-md text-body-md text-on-surface-variant">
                Un rythme équilibré en segments doux pour apaiser le système nerveux, dénouer les tensions corporelles et stabiliser le souffle en toute sécurité.
              </p>
            </div>
            <div className="relative flex min-h-[510px] flex-col items-center justify-center overflow-hidden rounded-lg bg-surface-container-lowest p-space-xl shadow-md">
              <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-surface-container-low blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-secondary-container/40 blur-3xl" />
              <div className="z-10 mb-space-md flex w-full items-center justify-between">
                <span className="flex items-center gap-1.5 font-label-sm text-label-sm font-bold uppercase tracking-wider text-secondary">
                  <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                  Segment actif
                </span>
                <span className="rounded-full bg-surface-container px-space-md py-1 font-label-md text-label-md font-semibold text-primary">
                  Phase {Math.min(phaseNumber, 4)}/4 : {phaseText('respiration-carree', info.phase.key).badge}
                </span>
              </div>
              <Squircle info={info} api={api} large />
              {api.paused ? (
                <div className="mt-space-sm w-full max-w-md">
                  <PausedBanner>En pause : respirez naturellement à votre propre rythme, sans forcer.</PausedBanner>
                </div>
              ) : null}
              <div className="z-10 mt-space-lg flex w-full max-w-lg items-center justify-between gap-space-md">
                <button type="button" onClick={api.requestRestart} className="flex h-12 items-center gap-space-xs rounded-full bg-surface-container-low px-space-lg font-label-lg text-label-lg text-primary shadow-sm hover:bg-surface-container">
                  <Icon name="replay" size={20} />
                  Recommencer
                </button>
                <button
                  type="button"
                  onClick={api.togglePause}
                  aria-keyshortcuts="Space"
                  className="flex h-14 items-center gap-space-sm rounded-full bg-primary px-8 font-label-lg text-label-lg text-on-primary shadow-md transition-all hover:bg-secondary active:scale-95"
                >
                  <Icon name={api.running ? 'pause' : 'play_arrow'} size={24} filled />
                  <span className="font-bold tracking-tight">{api.running ? 'Pause' : 'Reprendre'}</span>
                  <span className="ml-1 rounded bg-white/20 px-1.5 py-0.5 font-label-sm text-label-sm opacity-80">Espace</span>
                </button>
                <button type="button" onClick={api.requestFinish} className="flex h-12 items-center gap-space-xs rounded-full bg-surface-container-low px-space-lg font-label-lg text-label-lg text-primary shadow-sm hover:bg-surface-container">
                  <Icon name="check_circle" size={20} />
                  Terminer
                </button>
              </div>
            </div>
            <div className="flex flex-col items-center justify-between gap-space-lg rounded-lg bg-surface-container-lowest p-space-lg shadow-sm md:flex-row">
              <div className="flex w-full items-center gap-space-lg md:w-auto">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                  <Icon name="air" size={24} />
                </span>
                <div>
                  <p className="font-label-lg text-label-lg font-bold text-primary">Progression du calme</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Cycle <span className="font-semibold text-primary" data-testid="cycle">{cycle}</span> sur {total}
                  </p>
                </div>
              </div>
              <div className="flex w-full flex-col gap-1.5 md:w-72">
                <div className="flex items-center justify-between font-label-sm text-label-sm font-medium text-on-surface-variant">
                  <span>
                    Écoulé : <strong className="font-semibold text-primary tabular-nums">{formatClock(active)}</strong>
                  </span>
                  <span>Total : {formatClock(session.targetMs)}</span>
                </div>
                <ProgressBar value={active / session.targetMs} label="Progression de la séance" />
              </div>
            </div>
          </section>
          <DesktopCustomization api={api} session={session} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col pb-space-md">
      <div className="flex w-full flex-col pb-space-md pt-space-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm font-medium uppercase tracking-wider text-secondary">{api.exercise.eyebrow}</span>
            <h2 className="font-headline-md text-headline-md text-primary">{api.exercise.title}</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Cadence équilibrée en {info.segment.phases.length} temps</p>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1.5 shadow-sm">
              <span className={`h-2 w-2 rounded-full ${api.running ? 'animate-pulse bg-secondary' : 'bg-outline'}`} />
              <span className="font-label-lg text-label-lg font-semibold text-primary tabular-nums" data-testid="remaining">
                {formatRemaining(remaining)}
              </span>
            </div>
            <span className="mt-1 font-label-sm text-label-sm text-on-surface-variant">Restant</span>
          </div>
        </div>
      </div>
      <div className="flex w-full flex-col space-y-space-md">
        <div className="flex items-center gap-3 rounded bg-surface-container-lowest p-3.5 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
            <Icon name="spa" size={20} filled />
          </span>
          <p className="font-body-sm text-body-sm leading-tight text-primary">{api.exercise.cue}</p>
        </div>
        {api.paused ? <PausedBanner /> : null}
        <Squircle info={info} api={api} large={false} />
        <HoldsBanner api={api} session={session} />
        <div className="space-y-2 rounded bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-label-md text-label-md font-semibold text-primary">
              <Icon name="repeat" size={18} className="text-on-surface-variant" />
              <span data-testid="cycle">
                Cycle {cycle} sur {total}
              </span>
            </span>
            <span className="font-label-md text-label-md text-on-surface-variant tabular-nums">
              {formatClock(active)} / {formatClock(session.targetMs)}
            </span>
          </div>
          <ProgressBar value={active / session.targetMs} label="Progression de la séance" track="bg-surface-container-high" />
        </div>
        <SensoryToggles api={api} soundLabel="Guide sonore doux" hapticLabel="Retour haptique" compact />
        <div className="flex items-center justify-between gap-2 pt-space-xs xs:px-space-sm">
          <button type="button" onClick={api.requestRestart} aria-label="Recommencer la séance" className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-surface-container-low text-primary shadow-sm active:scale-95">
            <Icon name="restart_alt" size={24} />
          </button>
          <button
            type="button"
            onClick={api.togglePause}
            className="flex min-h-[56px] min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-primary-container px-4 py-3 text-center text-on-primary shadow-md transition-transform active:scale-95 xs:flex-none xs:whitespace-nowrap xs:px-8"
          >
            <Icon name={api.running ? 'pause' : 'play_arrow'} size={28} filled />
            <span className="font-label-lg text-label-lg font-semibold tracking-wide">{api.running ? 'Mettre en pause' : 'Reprendre'}</span>
          </button>
          <button type="button" onClick={api.requestFinish} aria-label="Terminer la séance" className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-surface-container-low text-primary shadow-sm active:scale-95">
            <Icon name="check" size={24} />
          </button>
        </div>
        <div className="flex justify-center">
          <button type="button" onClick={api.openSettings} className="flex min-h-[44px] items-center gap-1 rounded-full px-4 font-label-md text-label-md text-secondary hover:bg-surface-container-low">
            <Icon name="tune" size={18} />
            Régler la cadence
          </button>
        </div>
      </div>
      <div className="mt-space-md rounded bg-surface-container-low p-4 text-on-surface-variant">
        <div className="flex items-start gap-2.5">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-outline" />
          <p className="font-label-sm text-label-sm leading-relaxed">
            <span className="font-semibold text-primary">Consignes de confort et sécurité :</span> {api.exercise.safety}
          </p>
        </div>
      </div>
    </div>
  );
}

