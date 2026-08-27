import type * as ChildProcessModule from "node:child_process";
import { Ingress } from "@nextclaw/shared";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const extensionRuntimeMocks = vi.hoisted(() => {
  const spawnMock = vi.fn();
  (globalThis as typeof globalThis & { __nextclawExtensionSpawnMock: typeof spawnMock }).__nextclawExtensionSpawnMock = spawnMock;
  return { spawnMock };
});
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof ChildProcessModule>();
  return { ...actual, spawn: extensionRuntimeMocks.spawnMock };
});
import { ExtensionRuntimeService } from "./extension-runtime.service.js";
import { createDesktopRuntimeOptions, createDiagnostics, createFakeChildProcess, createTempDir, markSpawnedExtensionReady, sessionManager, spawnMock, writeExtensionManifest } from "./extension-runtime.test-fixtures.js";
import "./extension-runtime.test-fixtures.js";

describe("ExtensionRuntimeService observations", () => {
  it("releases an observation lease when subscription acknowledgement fails", async () => {
    spawnMock.mockImplementation(() => createFakeChildProcess(5005));
    const workspace = createTempDir();
    const root = join(workspace, ".nextclaw", "extensions");
    mkdirSync(root, { recursive: true });
    writeExtensionManifest(root);
    const ingress = new Ingress();
    const eventBus = { emitEnvelope: vi.fn() };
    const config = {
      channels: { "fake-channel": { enabled: false } },
    } as never;
    const runtime = new ExtensionRuntimeService({
      ...createDesktopRuntimeOptions(workspace),
      diagnostics: createDiagnostics(),
      eventBus,
      getConfig: () => config,
      getWorkspace: () => workspace,
      ingress,
      messageBus: { publishInbound: vi.fn(async () => undefined) },
      sessionManager,
    });
    runtime.registerIngressHandlers();
    await runtime.loadChannelContributions({ config, workspace });
    await runtime.start({ endpoint: "http://127.0.0.1:55667" });

    const subscribing = runtime.observations.subscribeObservation({
      extensionId: "fake-extension",
      subscriptionId: "subscription-rejected",
      config: { path: "payments.ts" },
    });
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const spawned = await markSpawnedExtensionReady(ingress);
    await vi.waitFor(() =>
      expect(eventBus.emitEnvelope).toHaveBeenCalledTimes(1),
    );
    const request = eventBus.emitEnvelope.mock.calls[0]?.[0];
    await ingress.handle(
      {
        type: "extension.response",
        extensionId: "fake-extension",
        generation: spawned.generation,
        payload: {
          requestId: request?.payload?.requestId,
          ok: false,
          error: { message: "subscription rejected" },
        },
      },
      { source: "test", token: spawned.token },
    );

    await expect(subscribing).rejects.toThrow("subscription rejected");
    expect(runtime.getStatus()[0]?.leaseReasons).not.toContainEqual({
      kind: "observation-subscription",
      subscriptionId: "subscription-rejected",
    });
  });

  it("deduplicates concurrent subscription acknowledgements for one extension binding", async () => {
    spawnMock.mockImplementation(() => createFakeChildProcess(5008));
    const workspace = createTempDir();
    const root = join(workspace, ".nextclaw", "extensions");
    mkdirSync(root, { recursive: true });
    writeExtensionManifest(root);
    const ingress = new Ingress();
    const eventBus = { emitEnvelope: vi.fn() };
    const config = { channels: { "fake-channel": { enabled: false } } } as never;
    const runtime = new ExtensionRuntimeService({
      ...createDesktopRuntimeOptions(workspace),
      diagnostics: createDiagnostics(),
      eventBus,
      getConfig: () => config,
      getWorkspace: () => workspace,
      ingress,
      messageBus: { publishInbound: vi.fn(async () => undefined) },
      sessionManager,
    });
    runtime.registerIngressHandlers();
    await runtime.loadChannelContributions({ config, workspace });
    await runtime.start({ endpoint: "http://127.0.0.1:55667" });

    const first = runtime.observations.subscribeObservation({
      extensionId: "fake-extension",
      subscriptionId: "same-subscription",
      config: { path: "payments.ts" },
    });
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const spawned = await markSpawnedExtensionReady(ingress);
    await vi.waitFor(() => expect(eventBus.emitEnvelope).toHaveBeenCalledTimes(1));
    const second = runtime.observations.subscribeObservation({
      extensionId: "fake-extension",
      subscriptionId: "same-subscription",
      config: { path: "other.ts" },
    });
    await vi.waitFor(() => expect(eventBus.emitEnvelope).toHaveBeenCalledTimes(1));
    const request = eventBus.emitEnvelope.mock.calls[0]?.[0];
    expect(request?.payload?.kind).toBe("observation.subscribe");
    await ingress.handle(
      {
        type: "extension.response",
        extensionId: "fake-extension",
        generation: spawned.generation,
        payload: {
          requestId: request?.payload?.requestId,
          ok: true,
          data: { replay: "supported" },
        },
      },
      { source: "test", token: spawned.token },
    );

    await expect(Promise.all([first, second])).resolves.toEqual([
      { replay: "supported" },
      { replay: "supported" },
    ]);
    expect(eventBus.emitEnvelope).toHaveBeenCalledTimes(1);
    expect(runtime.getStatus()[0]?.leaseReasons).toContainEqual({
      kind: "observation-subscription",
      subscriptionId: "same-subscription",
    });
  });

  it("notifies observation restoration after ready without delaying the runtime-ready acknowledgement", async () => {
    spawnMock.mockImplementation(() => createFakeChildProcess(5007));
    const workspace = createTempDir();
    const root = join(workspace, ".nextclaw", "extensions");
    mkdirSync(root, { recursive: true });
    writeExtensionManifest(root);
    const ingress = new Ingress();
    const restoration = vi.fn(() => new Promise<void>(() => undefined));
    const config = { channels: { "fake-channel": { enabled: true } } } as never;
    const runtime = new ExtensionRuntimeService({
      ...createDesktopRuntimeOptions(workspace),
      diagnostics: createDiagnostics(),
      eventBus: { emitEnvelope: vi.fn() },
      getConfig: () => config,
      getWorkspace: () => workspace,
      ingress,
      messageBus: { publishInbound: vi.fn(async () => undefined) },
      onObservationRuntimeReady: restoration,
      sessionManager,
    });
    runtime.registerIngressHandlers();
    await runtime.loadChannelContributions({ config, workspace });
    const started = runtime.start({ endpoint: "http://127.0.0.1:55667" });
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));

    await expect(markSpawnedExtensionReady(ingress)).resolves.toEqual(
      expect.objectContaining({ extensionId: "fake-extension" }),
    );
    await expect(started).resolves.toBeUndefined();
    expect(restoration).toHaveBeenCalledWith("fake-extension");
  });
});

describe("ExtensionRuntimeService observation events", () => {
  it("keeps a lease for declared event subscriptions and routes authenticated events", async () => {
    spawnMock.mockImplementation(() => createFakeChildProcess(5006));
    const workspace = createTempDir();
    const root = join(workspace, ".nextclaw", "extensions");
    mkdirSync(root, { recursive: true });
    writeExtensionManifest(root);
    const ingress = new Ingress();
    const eventBus = { emitEnvelope: vi.fn() };
    const onObservationEvent = vi.fn(async () => ({ accepted: true }));
    const config = {
      channels: { "fake-channel": { enabled: false } },
    } as never;
    const runtime = new ExtensionRuntimeService({
      ...createDesktopRuntimeOptions(workspace),
      diagnostics: createDiagnostics(),
      eventBus,
      getConfig: () => config,
      getWorkspace: () => workspace,
      ingress,
      messageBus: { publishInbound: vi.fn(async () => undefined) },
      onObservationEvent,
      sessionManager,
    });
    runtime.registerIngressHandlers();
    await runtime.loadChannelContributions({ config, workspace });
    await runtime.start({ endpoint: "http://127.0.0.1:55667" });

    const subscribing = runtime.observations.subscribeObservation({
      extensionId: "fake-extension",
      subscriptionId: "subscription-1",
      config: { path: "payments.ts" },
    });
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const spawned = await markSpawnedExtensionReady(ingress);
    await vi.waitFor(() =>
      expect(eventBus.emitEnvelope).toHaveBeenCalledTimes(1),
    );
    const subscribeRequest = eventBus.emitEnvelope.mock.calls[0]?.[0];
    expect(subscribeRequest).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          kind: "observation.subscribe",
          payload: {
            subscriptionId: "subscription-1",
            config: { path: "payments.ts" },
          },
        }),
      }),
    );
    await ingress.handle(
      {
        type: "extension.response",
        extensionId: "fake-extension",
        generation: spawned.generation,
        payload: {
          requestId: subscribeRequest?.payload?.requestId,
          ok: true,
          data: { replay: "supported" },
        },
      },
      { source: "test", token: spawned.token },
    );
    await expect(subscribing).resolves.toEqual({ replay: "supported" });
    expect(runtime.getStatus()[0]?.leaseReasons).toContainEqual({
      kind: "observation-subscription",
      subscriptionId: "subscription-1",
    });

    await expect(
      ingress.handle(
        {
          type: "extension.observation.event",
          extensionId: "fake-extension",
          generation: "stale-generation",
          payload: {
            subscriptionId: "subscription-1",
            event: {
              eventId: "event-1",
              eventType: "file.changed",
              occurredAt: "2026-08-22T00:00:00.000Z",
              payload: {},
            },
          },
        },
        { source: "test", token: spawned.token },
      ),
    ).rejects.toThrow("Unauthorized ingress token");
    await expect(
      ingress.handle(
        {
          type: "extension.observation.event",
          extensionId: "fake-extension",
          generation: spawned.generation,
          payload: {
            subscriptionId: "subscription-1",
            event: {
              eventId: "event-1",
              eventType: "file.changed",
              occurredAt: "2026-08-22T00:00:00.000Z",
              payload: { changed: true },
            },
          },
        },
        { source: "test", token: spawned.token },
      ),
    ).resolves.toEqual({ accepted: true });
    expect(onObservationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        extensionId: "fake-extension",
        subscriptionId: "subscription-1",
        event: expect.objectContaining({
          eventId: "event-1",
          payload: { changed: true },
        }),
      }),
    );

    eventBus.emitEnvelope.mockClear();
    const unsubscribing = runtime.observations.unsubscribeObservation({
      extensionId: "fake-extension",
      subscriptionId: "subscription-1",
    });
    await vi.waitFor(() =>
      expect(eventBus.emitEnvelope).toHaveBeenCalledTimes(1),
    );
    const unsubscribeRequest = eventBus.emitEnvelope.mock.calls[0]?.[0];
    expect(unsubscribeRequest).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          kind: "observation.unsubscribe",
          payload: { subscriptionId: "subscription-1" },
        }),
      }),
    );
    await ingress.handle(
      {
        type: "extension.response",
        extensionId: "fake-extension",
        generation: spawned.generation,
        payload: {
          requestId: unsubscribeRequest?.payload?.requestId,
          ok: false,
          error: { message: "unsubscribe failed" },
        },
      },
      { source: "test", token: spawned.token },
    );
    await expect(unsubscribing).rejects.toThrow("unsubscribe failed");
    expect(runtime.getStatus()[0]?.leaseReasons).not.toContainEqual({
      kind: "observation-subscription",
      subscriptionId: "subscription-1",
    });
  });
});
