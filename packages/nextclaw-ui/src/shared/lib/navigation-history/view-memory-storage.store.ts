import type { StateStorage } from 'zustand/middleware';

/** Owns best-effort browser IO; denied storage never blocks view navigation. */
export class ViewMemoryStorage implements StateStorage {
  constructor(private readonly resolveStorage: () => Storage = () => window.localStorage) {}

  getItem = (key: string): string | null => {
    try { return this.resolveStorage().getItem(key); }
    catch { return null; }
  };

  setItem = (key: string, value: string): void => {
    try { this.resolveStorage().setItem(key, value); }
    catch { /* Keep the active in-memory view usable. */ }
  };

  removeItem = (key: string): void => {
    try { this.resolveStorage().removeItem(key); }
    catch { /* Storage may be blocked or full. */ }
  };
}
