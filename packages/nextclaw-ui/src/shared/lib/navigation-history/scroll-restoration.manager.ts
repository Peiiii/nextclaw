export type ScrollRestorationPosition = Readonly<{
  x: number;
  y: number;
  payload?: unknown;
}>;

const DEFAULT_SCROLL_RESTORATION_CAPACITY = 200;

function normalizeCoordinate(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeKey(key: string): string | null {
  const normalized = key.trim();
  return normalized ? normalized : null;
}

/** Shared, bounded reading memory; optional session storage survives a page reload. */
export class ScrollRestorationManager {
  private readonly positions = new Map<string, ScrollRestorationPosition>();

  public constructor(
    private readonly capacity = DEFAULT_SCROLL_RESTORATION_CAPACITY,
    private readonly storage?: Storage,
  ) {
    try {
      const saved: unknown = JSON.parse(storage?.getItem('nextclaw.view-memory.v1') ?? 'null');
      if (Array.isArray(saved)) for (const entry of saved.slice(-capacity)) {
        if (!Array.isArray(entry) || typeof entry[0] !== 'string') continue;
        const value = entry[1];
        if (value && typeof value.x === 'number' && typeof value.y === 'number' && Number.isFinite(value.x) && Number.isFinite(value.y)) this.positions.set(entry[0], value);
      }
    } catch { /* Private mode, stale data or quota cannot block navigation. */ }
  }

  private persist = (): void => {
    try {
      const entries = [...this.positions];
      let json = JSON.stringify(entries);
      while (json.length > 512_000 && entries.length > 0) {
        entries.shift();
        json = JSON.stringify(entries);
      }
      this.storage?.setItem('nextclaw.view-memory.v1', json);
    } catch { /* Keep the in-memory position when browser storage is unavailable. */ }
  }

  public save = (key: string, position: ScrollRestorationPosition): void => {
    const normalizedKey = normalizeKey(key);
    if (!normalizedKey) return;

    this.positions.delete(normalizedKey);
    this.positions.set(normalizedKey, {
      x: normalizeCoordinate(position.x),
      y: normalizeCoordinate(position.y),
      ...(position.payload === undefined ? {} : { payload: position.payload }),
    });
    while (this.positions.size > this.capacity) {
      const oldestKey = this.positions.keys().next().value;
      if (!oldestKey) return;
      this.positions.delete(oldestKey);
    }
    this.persist();
  }

  public read = (key: string): ScrollRestorationPosition | null => {
    const normalizedKey = normalizeKey(key);
    if (!normalizedKey) return null;
    const position = this.positions.get(normalizedKey);
    return position ? { ...position } : null;
  }

  public delete = (key: string): void => {
    const normalizedKey = normalizeKey(key);
    if (normalizedKey) this.positions.delete(normalizedKey);
    this.persist();
  }

  public clear = (): void => {
    this.positions.clear();
    this.persist();
  }
}

function getReadingMemoryStorage(): Storage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.sessionStorage; } catch { return undefined; }
}

export const scrollRestorationManager = new ScrollRestorationManager(DEFAULT_SCROLL_RESTORATION_CAPACITY, getReadingMemoryStorage());
