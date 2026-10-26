import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { App } from '../App';
import { HISTORY_KEY } from '../storage/history';
import type { SessionRecord } from '../domain/types';

/** Monday 26 October 2026, 10:00 local time (Europe/Paris in tests). */
export const TEST_NOW = new Date(2026, 9, 26, 10, 0, 0);

export function useFakeClock(at: Date = TEST_NOW): void {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'] });
  vi.setSystemTime(at);
}

export function renderApp(path = '/') {
  const user = userEvent.setup({ delay: null });
  const utils = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  return { user, ...utils };
}

/** Advances the fake clock and lets React process the resulting interval ticks. */
export async function advance(ms: number, step = 250): Promise<void> {
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      vi.advanceTimersByTime(Math.min(step, ms - t));
    });
  }
}

export function storedHistory(): SessionRecord[] {
  const raw = window.localStorage.getItem(HISTORY_KEY);
  return raw ? (JSON.parse(raw) as { sessions: SessionRecord[] }).sessions : [];
}

export function seedHistory(records: SessionRecord[]): void {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify({ schemaVersion: 1, sessions: records }));
}

export function makeRecord(id: string, start: Date, overrides: Partial<SessionRecord> = {}): SessionRecord {
  const activeSeconds = overrides.activeSeconds ?? 300;
  return {
    id,
    exerciseId: 'respiration-lente',
    status: 'completed',
    startedAt: start.toISOString(),
    endedAt: new Date(start.getTime() + activeSeconds * 1000).toISOString(),
    activeSeconds,
    pausedSeconds: 0,
    targetSeconds: 300,
    unitsTotal: null,
    unitsCompleted: null,
    unitsSkipped: null,
    cyclesCompleted: 30,
    feeling: null,
    ...overrides,
  };
}
