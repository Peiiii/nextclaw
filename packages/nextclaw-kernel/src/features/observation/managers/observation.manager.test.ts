import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventBus } from "@nextclaw/shared";
import type { ObservationExtensionRuntime } from "@kernel/features/observation/types/observation.types.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ObservationManager } from "./observation.manager.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(
      async (directory) =>
        await rm(directory, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 20,
        }),
    ),
  );
});

async function createStorePath(): Promise<string> {
  const directory = await mkdtemp(
    join(tmpdir(), "nextclaw-observation-manager-"),
  );
  temporaryDirectories.push(directory);
  return join(directory, "observations", "state.json");
}

function createDependencies() {
  const records = new Map<string, { messages: Array<{ id: string }> }>([
    ["session-1", { messages: [] }],
  ]);
  const ingressHandle = vi.fn(
    async (envelope: { payload?: { message?: { id?: string } } }) => ({
      sessionId: "session-1",
      userMessageId: envelope.payload?.message?.id ?? "unknown",
      assistantMessageId: null,
      runId: null,
      delivery: "queued" as const,
    }),
  );
  return {
    records,
    ingressHandle,
    sessionManager: {
      getAgentRunSession: vi.fn(async (sessionId: string) => ({
        sessionId,
        agentId: "main",
        agentRuntimeId: "native",
        metadata: {},
        workingDir: "/tmp",
      })),
      getSessionRecord: vi.fn(
        async (sessionId: string) => records.get(sessionId) ?? null,
      ),
    },
    agentManager: { getDefaultAgentId: () => "main" },
    ingress: { handle: ingressHandle },
    eventBus: new EventBus(),
  };
}

function createRuntime(): ObservationExtensionRuntime & {
  reads: ReturnType<typeof vi.fn>;
  subscriptions: ReturnType<typeof vi.fn>;
  unsubscriptions: ReturnType<typeof vi.fn>;
} {
  const reads = vi.fn(async ({ config }: { config: unknown }) => ({
    config,
    version: 1,
  }));
  const subscriptions = vi.fn(async () => ({ replay: "supported" as const }));
  const unsubscriptions = vi.fn(async () => undefined);
  return {
    discoverObservations: vi.fn((input = {}) =>
      [
        {
          extensionId: "test-extension",
          kind: "context" as const,
          title: "Test extension",
          description: "Reads current test state",
        },
        {
          extensionId: "test-extension",
          kind: "events" as const,
          title: "Test extension",
          description: "Emits test events",
          replay: "supported" as const,
        },
      ].filter((item) => !input.kinds || input.kinds.includes(item.kind)),
    ),
    readObservation: reads,
    subscribeObservation: subscriptions,
    unsubscribeObservation: unsubscriptions,
    reads,
    subscriptions,
    unsubscriptions,
  };
}

function createManager(
  storePath: string,
  dependencies: ReturnType<typeof createDependencies>,
) {
  return new ObservationManager({
    storePath,
    sessionManager: dependencies.sessionManager as never,
    agentManager: dependencies.agentManager as never,
    ingress: dependencies.ingress as never,
    eventBus: dependencies.eventBus,
  });
}

describe("ObservationManager", () => {
  it("discovers extension capabilities and rejects non-Native session targets", async () => {
    const dependencies = createDependencies();
    dependencies.sessionManager.getAgentRunSession.mockResolvedValue({
      sessionId: "session-1",
      agentId: "main",
      agentRuntimeId: "narp",
      metadata: {},
      workingDir: "/tmp",
    });
    const manager = createManager(await createStorePath(), dependencies);
    const runtime = createRuntime();
    manager.setExtensionRuntime(runtime);
    await manager.start();

    expect(manager.discoverObservations({ kinds: ["events"] })).toEqual([
      expect.objectContaining({
        extensionId: "test-extension",
        kind: "events",
      }),
    ]);
    await expect(
      manager.bindContext({
        extensionId: "test-extension",
        config: { path: "payments.ts" },
        targetSessionId: "session-1",
      }),
    ).rejects.toThrow("observation_runtime_unsupported");
    await expect(
      manager.subscribeEvents({
        extensionId: "test-extension",
        config: { path: "payments.ts" },
        targetSessionId: "session-1",
      }),
    ).rejects.toThrow("observation_runtime_unsupported");
    await manager.dispose();
  });

  it("persists extension context bindings and re-reads them after restart", async () => {
    const storePath = await createStorePath();
    const dependencies = createDependencies();
    const first = createManager(storePath, dependencies);
    const firstRuntime = createRuntime();
    first.setExtensionRuntime(firstRuntime);
    await first.start();
    const binding = await first.bindContext({
      extensionId: "test-extension",
      config: { resource: "payments" },
      targetSessionId: "session-1",
    });
    expect(
      await first.buildContextTail({ sessionId: "session-1" }),
    ).toMatchObject({
      entries: [
        {
          bindingId: binding.bindingId,
          extensionId: "test-extension",
          payload: { version: 1 },
        },
      ],
    });
    await first.dispose();

    const restarted = createManager(storePath, dependencies);
    const restartedRuntime = createRuntime();
    restartedRuntime.reads.mockResolvedValue({ version: 2 });
    restarted.setExtensionRuntime(restartedRuntime);
    await restarted.start();
    expect(
      (await restarted.listObservations("session-1")).bindings,
    ).toMatchObject([
      {
        bindingId: binding.bindingId,
        extensionId: "test-extension",
        status: "active",
      },
    ]);
    expect(
      await restarted.buildContextTail({ sessionId: "session-1" }),
    ).toMatchObject({
      entries: [{ bindingId: binding.bindingId, payload: { version: 2 } }],
    });
    await restarted.dispose();
  });

  it("activates subscriptions, rejects foreign extension events, and persists delivery before ingress", async () => {
    const dependencies = createDependencies();
    const manager = createManager(await createStorePath(), dependencies);
    const runtime = createRuntime();
    manager.setExtensionRuntime(runtime);
    await manager.start();
    const subscription = await manager.subscribeEvents({
      extensionId: "test-extension",
      config: { path: "payments.ts" },
      targetSessionId: "session-1",
      admission: { dedupe: { key: "/dedupeKey", window: "PT30M" } },
    });
    expect(runtime.subscriptions).toHaveBeenCalledWith(
      expect.objectContaining({
        extensionId: "test-extension",
        subscriptionId: subscription.subscriptionId,
      }),
    );

    const event = {
      eventId: "event-1",
      eventType: "file.changed",
      occurredAt: "2026-08-22T00:00:00.000Z",
      observedAt: "2026-08-22T00:00:01.000Z",
      dedupeKey: "payments",
      payload: { path: "payments.ts" },
    };
    await expect(
      manager.acceptExtensionEvent({
        extensionId: "other-extension",
        subscriptionId: subscription.subscriptionId,
        event,
      }),
    ).resolves.toEqual({ accepted: false });
    expect(dependencies.ingressHandle).not.toHaveBeenCalled();

    await expect(
      manager.acceptExtensionEvent({
        extensionId: "test-extension",
        subscriptionId: subscription.subscriptionId,
        event,
      }),
    ).resolves.toEqual({ accepted: true });
    const state = await manager.listObservations("session-1");
    expect(state.deliveries).toMatchObject([
      { eventId: "event-1", status: "submitted", event },
    ]);
    expect(dependencies.ingressHandle).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "observation",
        payload: expect.objectContaining({
          message: expect.objectContaining({
            role: "service",
            id: state.deliveries[0]?.messageId,
          }),
        }),
      }),
      expect.anything(),
    );

    await manager.updateObservation("pause", {
      kind: "event_subscription",
      id: subscription.subscriptionId,
    });
    expect(runtime.unsubscriptions).toHaveBeenCalledWith({
      extensionId: "test-extension",
      subscriptionId: subscription.subscriptionId,
    });
    await expect(
      manager.acceptExtensionEvent({
        extensionId: "test-extension",
        subscriptionId: subscription.subscriptionId,
        event: { ...event, eventId: "late" },
      }),
    ).resolves.toEqual({ accepted: false });
    await manager.dispose();
  });

  it("restores the same subscription id and cursor after runtime restart", async () => {
    const storePath = await createStorePath();
    const dependencies = createDependencies();
    const first = createManager(storePath, dependencies);
    const firstRuntime = createRuntime();
    first.setExtensionRuntime(firstRuntime);
    await first.start();
    const subscription = await first.subscribeEvents({
      extensionId: "test-extension",
      config: { path: "payments.ts" },
      targetSessionId: "session-1",
    });
    await first.acceptExtensionEvent({
      extensionId: "test-extension",
      subscriptionId: subscription.subscriptionId,
      event: {
        eventId: "event-1",
        eventType: "file.changed",
        occurredAt: "2026-08-22T00:00:00.000Z",
        observedAt: "2026-08-22T00:00:01.000Z",
        cursor: "cursor-1",
        payload: {},
      },
    });
    await first.dispose();

    const restarted = createManager(storePath, dependencies);
    const runtime = createRuntime();
    restarted.setExtensionRuntime(runtime);
    await restarted.start();
    expect(runtime.subscriptions).toHaveBeenCalledWith({
      extensionId: "test-extension",
      subscriptionId: subscription.subscriptionId,
      config: { path: "payments.ts" },
      cursor: "cursor-1",
    });
    await restarted.dispose();
  });
});
