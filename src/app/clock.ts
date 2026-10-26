/**
 * Single access point to wall-clock time for the UI layer. The engine itself never reads the
 * clock; tests control time with fake timers (Vitest) or `page.clock` (Playwright).
 */
export function now(): number {
  return Date.now();
}
