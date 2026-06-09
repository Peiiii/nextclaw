import { describe, expect, it } from 'vitest';
import { AdaptiveCadence } from '../adaptive-cadence.service';

function createClock(initialNow = 0) {
  let now = initialNow;
  return {
    clock: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

function createCadence(clock: () => number): AdaptiveCadence {
  return new AdaptiveCadence({
    idleDelayMs: 1000,
    manualTriggerDelayMs: 0,
    successDelayMs: false,
    stages: [
      { untilElapsedMs: 30_000, delaysMs: [500, 1000, 2000, 4000, 5000] },
      { untilElapsedMs: 5 * 60_000, delaysMs: [10_000, 15_000, 30_000] },
      { delaysMs: [60_000] },
    ],
    clock,
  });
}

describe('AdaptiveCadence', () => {
  it('uses idle delay before the first failure', () => {
    const { clock } = createClock();
    const cadence = createCadence(clock);

    expect(cadence.getNextDelay()).toBe(1000);
  });

  it('backs off inside the hot recovery stage', () => {
    const { clock } = createClock();
    const cadence = createCadence(clock);

    cadence.recordFailure();
    expect(cadence.getNextDelay()).toBe(500);
    cadence.recordFailure();
    expect(cadence.getNextDelay()).toBe(1000);
    cadence.recordFailure();
    expect(cadence.getNextDelay()).toBe(2000);
    cadence.recordFailure();
    expect(cadence.getNextDelay()).toBe(4000);
    cadence.recordFailure();
    expect(cadence.getNextDelay()).toBe(5000);
    cadence.recordFailure();
    expect(cadence.getNextDelay()).toBe(5000);
  });

  it('moves to slower stages as the same failure window ages', () => {
    const { advance, clock } = createClock();
    const cadence = createCadence(clock);

    cadence.recordFailure();
    advance(31_000);
    expect(cadence.getNextDelay()).toBe(10_000);

    cadence.recordFailure();
    cadence.recordFailure();
    expect(cadence.getNextDelay()).toBe(30_000);

    advance(5 * 60_000);
    expect(cadence.getNextDelay()).toBe(60_000);
  });

  it('stops after success and starts a fresh window after the next failure', () => {
    const { clock } = createClock();
    const cadence = createCadence(clock);

    cadence.recordFailure();
    cadence.recordFailure();
    expect(cadence.getNextDelay()).toBe(1000);

    cadence.recordSuccess();
    expect(cadence.getNextDelay()).toBe(false);

    cadence.recordFailure();
    expect(cadence.getNextDelay()).toBe(500);
  });

  it('supports a one-shot manual trigger delay', () => {
    const { clock } = createClock();
    const cadence = createCadence(clock);

    cadence.recordSuccess();
    cadence.requestManualTrigger();

    expect(cadence.getNextDelay({ consumeManualTrigger: true })).toBe(0);
    expect(cadence.getNextDelay()).toBe(1000);
  });
});
