import type { ReactNode } from 'react';
import { Icon, type IconName } from '../ui/Icon';
import type { PracticeApi } from './types';

export function ProgressBar({ value, label, className = 'h-2', track = 'bg-surface-container' }: { value: number; label: string; className?: string; track?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={`w-full overflow-hidden rounded-full ${track} ${className}`}
    >
      <div className="h-full rounded-full bg-secondary transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** "Guide sonore" / "Vibrations" quick toggles, stored as preferences. */
export function SensoryToggles({ api, soundLabel = 'Guide sonore', hapticLabel = 'Vibrations', compact = false }: { api: PracticeApi; soundLabel?: string; hapticLabel?: string; compact?: boolean }) {
  const { preferences, setPreferences } = api;
  const item = (active: boolean, icon: IconName, offIcon: IconName, label: string, onClick: () => void) => (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-full px-3 py-1.5 font-label-md text-label-md shadow-sm transition-all ${
        active ? 'bg-surface-container-low text-on-surface hover:bg-surface-container' : 'bg-surface-container-low/60 text-on-surface-variant'
      }`}
    >
      <Icon name={active ? icon : offIcon} size={16} filled={active} className={active ? 'text-secondary' : 'text-outline'} />
      <span>
        {label}
        {compact ? null : <> • {active ? 'Actif' : 'Inactif'}</>}
      </span>
    </button>
  );
  return (
    <div className="flex flex-wrap items-center justify-center gap-space-xs">
      {item(preferences.sound, 'volume_up', 'volume_off', soundLabel, () => setPreferences({ sound: !preferences.sound }))}
      {item(preferences.haptics, 'mobile_vibrate', 'do_not_disturb_on', hapticLabel, () => setPreferences({ haptics: !preferences.haptics }))}
    </div>
  );
}

/** Repartir · Pause/Play · Terminer — the dock from the slow-breathing screen. */
export function ControlDock({ api, finishLabel = 'Terminer', restartLabel = 'Repartir', tone = 'error' }: { api: PracticeApi; finishLabel?: string; restartLabel?: string; tone?: 'error' | 'neutral' }) {
  return (
    <div className="flex items-center justify-between gap-space-sm rounded-xl bg-surface-container-low px-space-md py-space-sm shadow-md">
      <button
        type="button"
        onClick={api.requestRestart}
        className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-full bg-surface-container px-space-sm py-3 font-label-lg text-label-lg font-semibold text-on-surface transition-all hover:bg-surface-container-high active:scale-95"
      >
        <Icon name="replay" size={18} />
        {restartLabel}
      </button>
      <PlayPauseButton api={api} />
      <button
        type="button"
        onClick={api.requestFinish}
        className={`flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-full bg-surface-container px-space-sm py-3 font-label-lg text-label-lg font-semibold transition-all active:scale-95 ${
          tone === 'error' ? 'text-error hover:bg-error-container hover:text-on-error-container' : 'text-primary hover:bg-surface-container-high'
        }`}
      >
        <Icon name={tone === 'error' ? 'stop_circle' : 'check_circle'} size={18} />
        {finishLabel}
      </button>
    </div>
  );
}

export function PlayPauseButton({ api, size = 56 }: { api: PracticeApi; size?: number }) {
  return (
    <button
      type="button"
      aria-label={api.running ? 'Mettre en pause' : 'Reprendre la séance'}
      onClick={api.togglePause}
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-full shadow-md transition-all active:scale-95 ${
        api.running ? 'bg-primary-container text-on-primary hover:bg-primary' : 'bg-secondary text-on-secondary hover:bg-on-secondary-container'
      }`}
    >
      <Icon name={api.running ? 'pause' : 'play_arrow'} size={Math.round(size / 2)} filled />
    </button>
  );
}

export function PausedBanner({ children = 'Séance en pause — respirez naturellement, à votre rythme.' }: { children?: ReactNode }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 rounded-full bg-surface-container-high px-space-md py-2 text-center font-label-lg text-label-lg text-primary">
      <Icon name="pause_circle" size={20} filled className="text-secondary" />
      <span>{children}</span>
    </div>
  );
}

export function SafetyFooter({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="mt-space-lg flex items-start gap-2.5 rounded-lg bg-surface-container-low p-space-md shadow-sm">
      <Icon name="info" size={18} className="mt-0.5 shrink-0 text-on-surface-variant" />
      <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
        <span className="font-semibold text-primary">{title} :</span> {children}
      </p>
    </aside>
  );
}

export function SettingsButton({ onClick, label = 'Réglages de la séance' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary shadow-sm transition-all hover:bg-surface-container-high active:scale-95"
    >
      <Icon name="tune" size={20} />
    </button>
  );
}

/** Cue + body reminder card. */
export function ReminderCard({ icon = 'self_improvement', title, children }: { icon?: IconName; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-space-sm rounded-lg bg-surface-container-lowest p-space-md shadow-sm">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
        <Icon name={icon} size={18} />
      </span>
      <div className="flex flex-col">
        <span className="font-label-lg text-label-lg font-semibold text-primary">{title}</span>
        <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">{children}</p>
      </div>
    </div>
  );
}

/** Smooth ease used to derive breathing scale from phase progress. */
export function ease(p: number): number {
  const t = Math.max(0, Math.min(1, p));
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Breathing scale derived from the *same* phase info as the labels and countdown.
 * Inhale grows, exhale shrinks, holds stay still; reduced motion keeps a constant size.
 */
export function breathScale(phaseKey: string, progress: number, reduced: boolean, min = 0.92, max = 1.12): number {
  if (reduced) return 1;
  switch (phaseKey) {
    case 'inhale':
      return min + (max - min) * ease(progress);
    case 'hold-in':
      return max;
    case 'exhale':
      return max - (max - min) * ease(progress);
    default:
      return min;
  }
}
