/** Minimal key/value interface implemented by `window.localStorage` and the in-memory fallback. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key?(index: number): string | null;
  readonly length?: number;
}

export type WriteError = 'quota' | 'unavailable';
export type WriteResult = { ok: true } | { ok: false; error: WriteError };

export class MemoryStore implements KeyValueStore {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  get length(): number {
    return this.map.size;
  }
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error) && !(typeof DOMException !== 'undefined' && error instanceof DOMException)) {
    return false;
  }
  const e = error as { name?: string; code?: number };
  return e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014;
}

export function safeWrite(store: KeyValueStore, key: string, value: string): WriteResult {
  try {
    store.setItem(key, value);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: isQuotaError(error) ? 'quota' : 'unavailable' };
  }
}

export function safeRemove(store: KeyValueStore, key: string): WriteResult {
  try {
    store.removeItem(key);
    return { ok: true };
  } catch {
    return { ok: false, error: 'unavailable' };
  }
}

export function safeRead(store: KeyValueStore, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

export interface BrowserStore {
  store: KeyValueStore;
  /** False when localStorage is unavailable (private mode, blocked cookies…). */
  persistent: boolean;
}

/** Returns localStorage when usable, otherwise an in-memory store (data lost on reload). */
export function getBrowserStore(): BrowserStore {
  try {
    const ls = window.localStorage;
    const probe = '__calme_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return { store: ls, persistent: true };
  } catch {
    return { store: new MemoryStore(), persistent: false };
  }
}

export const WRITE_ERROR_MESSAGES: Record<WriteError, string> = {
  quota: "L'espace de stockage de votre navigateur est plein. Libérez de l'espace ou exportez puis supprimez d'anciennes séances.",
  unavailable: "Le stockage local de votre navigateur est indisponible. Vos données n'ont pas pu être enregistrées.",
};
