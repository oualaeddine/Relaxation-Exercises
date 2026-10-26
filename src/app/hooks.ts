import { useEffect, useState } from 'react';
import { useAppData } from './AppData';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
}

export const DESKTOP_QUERY = '(min-width: 1024px)';

/** True when the OS asks for reduced motion or the user chose it in Calme's settings. */
export function useReducedMotion(): boolean {
  const { preferences } = useAppData();
  const system = useMediaQuery('(prefers-reduced-motion: reduce)');
  return preferences.motion === 'reduce' || system;
}

/**
 * Re-renders every `intervalMs` while `active`, returning the current time.
 * The interval is cleared when inactive or unmounted (no leaked timers).
 */
export function useNow(active: boolean, intervalMs = 250): number {
  const [time, setTime] = useState(() => Date.now());
  useEffect(() => {
    setTime(Date.now());
    if (!active) return undefined;
    const id = window.setInterval(() => setTime(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);
  return active ? time : Date.now();
}

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · Calme` : 'Calme — Respirez. Relâchez.';
  }, [title]);
}
