import { useId } from 'react';
import { BODY_SCAN_ZONES } from '../../domain/exercises';
import { formatClock } from '../../domain/format';
import { nextUnit, prevUnit, sequenceProgress, type SequenceSession } from '../../engine/session';
import type { SoundTimbre } from '../../storage/preferences';
import { Icon } from '../../ui/Icon';
import type { PracticeApi } from '../types';

/** Vertical position (SVG units) of each zone on the seated silhouette. */
const ZONE_Y = [272, 248, 212, 168, 132, 98, 58, 160];

export function BodyScanView({ api }: { api: PracticeApi }) {
  const session = api.session as SequenceSession;
  const p = sequenceProgress(session, api.now);
  const zone = BODY_SCAN_ZONES[p.unit]!;
  const total = session.steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  const soundId = useId();
  const soundValue: SoundTimbre | 'silence' = api.preferences.sound ? api.preferences.soundTimbre : 'silence';

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between rounded-full bg-surface-container-lowest py-2 pl-5 pr-2 shadow-sm">
        <span className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${api.running ? 'animate-pulse bg-secondary' : 'bg-outline'}`} />
          <span className="font-label-lg text-label-lg font-semibold tracking-wide text-primary tabular-nums">
            {formatClock(api.activeMs)} <span className="font-label-sm text-label-sm font-normal text-on-surface-variant">/ {formatClock(total)}</span>
          </span>
        </span>
        <label htmlFor={soundId} className="sr-only">
          Son de transition
        </label>
        <span className="flex items-center gap-1 rounded-full bg-surface-container-low pl-3 text-primary">
          <Icon name="music_note" size={16} className="text-secondary" />
          <select
            id={soundId}
            value={soundValue}
            onChange={(event) => {
              const v = event.target.value;
              if (v === 'silence') api.setPreferences({ sound: false });
              else api.setPreferences({ sound: true, soundTimbre: v as SoundTimbre });
            }}
            className="min-h-[44px] rounded-full bg-transparent pr-3 font-label-lg text-label-lg text-primary focus:outline-none"
          >
            <option value="bol">Bol tibétain</option>
            <option value="carillon">Carillon doux</option>
            <option value="silence">Silence total</option>
          </select>
        </span>
      </div>

      <div className="space-y-2 px-1">
        <div className="flex justify-between font-label-md text-label-md">
          <h2 className="font-semibold uppercase tracking-wider text-secondary" data-testid="zone-counter">
            Zone {p.unit + 1} sur {p.unitCount}
          </h2>
          <span className="font-medium text-on-surface-variant">{Math.round(((p.unit + 1) / p.unitCount) * 100)} % exploré</span>
        </div>
        <div className="flex h-1.5 w-full gap-1.5" aria-hidden="true">
          {session.outcomes.map((_, i) => (
            <span key={i} className={`h-full flex-1 rounded-full ${i <= p.unit ? 'bg-secondary' : 'bg-surface-variant'}`} />
          ))}
        </div>
      </div>

      <div className="relative flex flex-col items-center overflow-hidden rounded-3xl bg-gradient-to-b from-surface-container-lowest to-celadon/50 p-5 shadow-sm" data-testid="breath-visual" data-phase={zone.key}>
        <div className={`breath-transition absolute h-64 w-64 -translate-y-4 rounded-full bg-secondary-container/40 blur-3xl ${api.paused ? 'opacity-30' : ''}`} />
        {api.paused ? (
          <span role="status" className="absolute top-4 z-10 flex items-center gap-1.5 rounded-full bg-surface-container-lowest/90 px-3 py-1.5 font-label-md text-label-md font-medium text-primary shadow-sm">
            <Icon name="pause_circle" size={16} />
            Prenez tout votre temps
          </span>
        ) : null}
        <svg viewBox="0 0 200 320" className="relative z-[1] h-72 w-48" aria-hidden="true">
          <g opacity="0.5" stroke="#183653" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" fill="#eff4ff">
            <circle cx="100" cy="48" r="20" />
            <path d="M88 68 L88 78 M112 68 L112 78" />
            <path d="M70 86 Q100 74 130 86 Q138 120 132 160 Q128 196 100 204 Q72 196 68 160 Q62 120 70 86 Z" />
            <path d="M70 92 Q52 130 64 176 M130 92 Q148 130 136 176" fill="none" />
            <path d="M60 230 Q100 200 140 230 Q156 262 128 272 L72 272 Q44 262 60 230 Z" />
          </g>
          <g className="breath-transition" transform={`translate(100, ${ZONE_Y[p.unit] ?? 160})`}>
            <circle r="26" fill="#a2eee0" opacity="0.35" className={api.running ? 'animate-pulse' : ''} />
            <circle r="13" fill="#146a5f" opacity="0.25" />
            <circle r="6" fill="#fff" stroke="#146a5f" strokeWidth="3" />
          </g>
        </svg>
        <span className="z-10 mt-2 flex items-center gap-1.5 rounded-full bg-surface-container-low/90 px-4 py-1.5 font-label-sm text-label-sm text-on-surface-variant">
          <Icon name="air" size={15} className="text-secondary" />
          Rythme du souffle libre et naturel
        </span>
      </div>

      <div className="rounded-3xl bg-surface-container-lowest p-6 shadow-sm">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <span className="mb-0.5 block font-label-sm text-label-sm font-semibold uppercase tracking-wider text-secondary">Focus actuel</span>
            <h3 className="font-headline-md text-headline-md font-bold text-primary" data-testid="zone-title">
              {p.unit + 1}. {zone.title}
            </h3>
          </div>
          <Icon name="self_improvement" size={24} className="text-secondary" />
        </div>
        <p className="font-body-md text-body-md leading-relaxed text-on-surface">{zone.instruction}</p>
        {zone.hint ? (
          <p className="mt-4 flex items-start gap-2 rounded-3xl bg-surface-container-low p-4 font-body-sm text-body-sm text-on-surface-variant">
            <Icon name="lightbulb" size={18} className="mt-0.5 shrink-0 text-secondary" />
            {zone.hint}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => api.act(prevUnit)} disabled={p.unit === 0} aria-label="Zone précédente" className="flex min-h-[56px] flex-1 items-center justify-center gap-1 rounded-full bg-surface-container-lowest text-primary shadow-sm hover:bg-surface-container disabled:opacity-40">
          <Icon name="skip_previous" size={20} />
          <span className="hidden font-label-md text-label-md font-semibold xs:inline">Précédent</span>
        </button>
        <button type="button" onClick={api.togglePause} className="flex min-h-[56px] flex-[1.2] items-center justify-center gap-2 rounded-full bg-primary px-6 text-on-primary shadow-md hover:bg-primary-container active:scale-95">
          <Icon name={api.running ? 'pause' : 'play_arrow'} size={26} filled />
          <span className="font-label-lg text-label-lg font-semibold">{api.running ? 'Pause' : 'Reprendre'}</span>
        </button>
        <button type="button" onClick={() => api.act(nextUnit)} aria-label={p.isLastUnit ? 'Terminer la dernière zone' : 'Zone suivante'} className="flex min-h-[56px] flex-1 items-center justify-center gap-1 rounded-full bg-surface-container-lowest text-primary shadow-sm hover:bg-surface-container">
          <span className="hidden font-label-md text-label-md font-semibold xs:inline">Suivant</span>
          <Icon name="skip_next" size={20} />
        </button>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={api.requestFinish} className="flex min-h-[44px] items-center gap-1 px-3 font-label-md text-label-md text-on-surface-variant hover:text-primary">
          <Icon name="check_circle" size={16} />
          Conclure la séance maintenant
        </button>
        <button type="button" onClick={api.openSettings} className="flex min-h-[44px] items-center gap-1 px-3 font-label-md text-label-md text-on-surface-variant hover:text-primary">
          <Icon name="tune" size={16} />
          Réglages
        </button>
      </div>
    </div>
  );
}
