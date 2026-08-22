import { describe, expect, it, vi } from "vitest";
import { EventBus, Ingress, createTypedKey } from "@nextclaw/shared";
import { Contribution, NextclawContributionRegistry } from "./nextclaw-contribution.manager.js";
import { runNextclawTaskWithHarness } from "@kernel/features/harness/utils/nextclaw-task.utils.js";
import type {
  IKernel,
  INextclawHarness,
} from "@kernel/features/harness/types/nextclaw-harness.types.js";

describe("Harness contribution lifecycle", () => {
  it("binds the restricted kernel and releases effects in reverse order", async () => {
    const calls: string[] = [];
    const kernel = {
      tools: {
        register: vi.fn(() => () => calls.push("dispose:tool")),
      },
    } as unknown as IKernel;

    class FixtureContribution extends Contribution {
      constructor() {
        super({ id: "fixture" });
      }

      protected setup = (): void => {
        this.effect(() => {
          calls.push("start:first");
          return () => calls.push("dispose:first");
        });
        this.effect(() => {
          calls.push("start:tool");
          return this.kernel.tools.register({ name: "fixture" } as never);
        });
      };
    }

    const registry = new NextclawContributionRegistry();
    registry.register(new FixtureContribution());
    await registry.start(kernel);
    await registry.dispose();

    expect(calls).toEqual([
      "start:first",
      "start:tool",
      "dispose:tool",
      "dispose:first",
    ]);
  });

  it("releases event and ingress registrations through the contribution scope", async () => {
    const eventBus = new EventBus();
    const ingress = new Ingress();
    const eventKey = createTypedKey<string>("fixture.event");
    const ingressKey = createTypedKey<{ value: string }>("fixture.ingress");
    const observed: string[] = [];

    class InfrastructureContribution extends Contribution {
      constructor() {
        super({ id: "infrastructure" });
      }

      protected setup = (): void => {
        this.effect(() =>
          this.kernel.eventBus.on(eventKey, (payload) => observed.push(payload)),
        );
        this.effect(() =>
          this.kernel.ingress.addHandler(ingressKey, ({ payload }) =>
            payload?.value.toUpperCase(),
          ),
        );
      };
    }

    const registry = new NextclawContributionRegistry();
    registry.register(new InfrastructureContribution());
    await registry.start({ eventBus, ingress } as unknown as IKernel);

    eventBus.emit(eventKey, "before-dispose");
    await expect(
      ingress.handle(
        { type: ingressKey, payload: { value: "ready" } },
        { source: "test" },
      ),
    ).resolves.toBe("READY");

    await registry.dispose();
    eventBus.emit(eventKey, "after-dispose");

    expect(observed).toEqual(["before-dispose"]);
    await expect(
      ingress.handle(
        { type: ingressKey, payload: { value: "released" } },
        { source: "test" },
      ),
    ).rejects.toThrow("Unsupported ingress type: fixture.ingress");
  });
});

describe("runNextclawTaskWithHarness", () => {
  it("always disposes the supplied harness", async () => {
    const harness = {
      start: vi.fn(async () => undefined),
      runTask: vi.fn(async () => ({ text: "done" })),
      dispose: vi.fn(async () => undefined),
    } as unknown as INextclawHarness;

    await expect(
      runNextclawTaskWithHarness(harness, { input: "hello" }),
    ).resolves.toMatchObject({ text: "done" });
    expect(harness.dispose).toHaveBeenCalledTimes(1);
  });
});
