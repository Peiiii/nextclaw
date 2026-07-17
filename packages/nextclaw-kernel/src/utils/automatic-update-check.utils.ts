export const AUTOMATIC_UPDATE_CHECK_INTERVAL_MS = 2 * 60 * 60 * 1000;

const MINIMUM_VERIFICATION_INTERVAL_MS = 100;

type AutomaticUpdateCheckIntervalOptions = {
  verificationMode: boolean;
  verificationIntervalMs: string | undefined;
};

export function resolveAutomaticUpdateCheckIntervalMs(
  options: AutomaticUpdateCheckIntervalOptions,
): number {
  if (!options.verificationMode) {
    return AUTOMATIC_UPDATE_CHECK_INTERVAL_MS;
  }

  const intervalMs = Number(options.verificationIntervalMs);
  if (!Number.isInteger(intervalMs) || intervalMs < MINIMUM_VERIFICATION_INTERVAL_MS) {
    throw new Error(
      `NEXTCLAW_UPDATE_VERIFICATION_INTERVAL_MS must be an integer of at least ${MINIMUM_VERIFICATION_INTERVAL_MS}.`,
    );
  }
  return intervalMs;
}

export function getAutomaticUpdateCheckDelay(
  lastCheckedAt: string | null,
  now: number,
  intervalMs = AUTOMATIC_UPDATE_CHECK_INTERVAL_MS,
): number {
  const lastCheckedAtMs = Date.parse(lastCheckedAt ?? "");
  if (!Number.isFinite(lastCheckedAtMs) || lastCheckedAtMs > now) {
    return 0;
  }
  return Math.max(0, lastCheckedAtMs + intervalMs - now);
}
