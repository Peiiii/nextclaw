const BASE_RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_DELAY_MS = 30 * 60_000;
const RECONNECT_JITTER_RATIO = 0.2;

export function resolveReconnectDelayMs(attempt: number, random: () => number): number {
  const exponentialDelayMs = Math.min(
    BASE_RECONNECT_DELAY_MS * 2 ** Math.max(0, attempt - 1),
    MAX_RECONNECT_DELAY_MS
  );
  const jitterRatio = ((random() * 2) - 1) * RECONNECT_JITTER_RATIO;
  return Math.max(
    BASE_RECONNECT_DELAY_MS,
    Math.round(exponentialDelayMs * (1 + jitterRatio))
  );
}

export function formatReconnectDelay(delayMs: number): string {
  const seconds = delayMs / 1000;
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
}
