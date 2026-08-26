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

/** Owns bounded, in-memory scroll positions for app-internal return navigation. */
export class ScrollRestorationManager {
  private readonly positions = new Map<string, ScrollRestorationPosition>();

  public constructor(
    private readonly capacity = DEFAULT_SCROLL_RESTORATION_CAPACITY,
  ) {}

  public save(key: string, position: ScrollRestorationPosition): void {
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
  }

  public read(key: string): ScrollRestorationPosition | null {
    const normalizedKey = normalizeKey(key);
    if (!normalizedKey) return null;
    const position = this.positions.get(normalizedKey);
    return position ? { ...position } : null;
  }

  public delete(key: string): void {
    const normalizedKey = normalizeKey(key);
    if (normalizedKey) this.positions.delete(normalizedKey);
  }

  public clear(): void {
    this.positions.clear();
  }
}

export const scrollRestorationManager = new ScrollRestorationManager();
