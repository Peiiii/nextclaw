import { describe, expect, it, vi } from "vitest";
import { Contribution } from "./contribution.manager.js";
import { EffectScope } from "./effect-scope.manager.js";

describe("EffectScope", () => {
  it("starts in declaration order and disposes in reverse order", async () => {
    const calls: string[] = [];
    const scope = new EffectScope();
    scope.register(() => {
      calls.push("start:first");
      return () => calls.push("dispose:first");
    });
    scope.register(() => {
      calls.push("start:second");
      return () => calls.push("dispose:second");
    });

    await scope.start();
    await scope.dispose();

    expect(calls).toEqual([
      "start:first",
      "start:second",
      "dispose:second",
      "dispose:first",
    ]);
  });

  it("rolls back active effects when a later setup fails", async () => {
    const cleanup = vi.fn();
    const scope = new EffectScope();
    scope.register(() => cleanup);
    scope.register(() => {
      throw new Error("boom");
    });

    await expect(scope.start()).rejects.toThrow("boom");
    expect(cleanup).toHaveBeenCalledTimes(1);
    await scope.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("supports early release without double disposal", async () => {
    const cleanup = vi.fn();
    const scope = new EffectScope();
    const release = scope.register(() => cleanup);
    await scope.start();
    await release();
    await release();
    await scope.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("releases cleanup produced after an effect was released during startup", async () => {
    let finishSetup: ((cleanup: () => void) => void) | undefined;
    const cleanup = vi.fn();
    const scope = new EffectScope();
    const release = scope.register(
      () =>
        new Promise<() => void>((resolve) => {
          finishSetup = resolve;
        }),
    );

    const started = scope.start();
    await release();
    finishSetup?.(cleanup);
    await started;
    await scope.dispose();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

describe("Contribution", () => {
  it("declares effects through setup and retries after startup failure", async () => {
    let attempts = 0;
    const cleanup = vi.fn();
    class FixtureContribution extends Contribution {
      protected setup = (): void => {
        this.effect(() => {
          attempts += 1;
          if (attempts === 1) {
            throw new Error("retry");
          }
          return cleanup;
        });
      };
    }

    const contribution = new FixtureContribution();
    await expect(contribution.start()).rejects.toThrow("retry");
    await contribution.start();
    await contribution.dispose();
    await contribution.start();
    await contribution.dispose();
    expect(attempts).toBe(3);
    expect(cleanup).toHaveBeenCalledTimes(2);
  });
});
