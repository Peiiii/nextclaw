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
import { createDiagnostics, createFakeChildProcess, createTempDir, markSpawnedExtensionReady, sessionManager, spawnMock, writeExtensionManifest } from "./extension-runtime.test-fixtures.js";
import "./extension-runtime.test-fixtures.js";

describe("ExtensionRuntimeService requests", () => {
  it("keeps disabled auth sessions on one generation until a terminal response", async () => {
    spawnMock.mockImplementation(() => createFakeChildProcess(5001));
    const workspace = createTempDir();
    const root = join(workspace, ".nextclaw", "extensions");
    mkdirSync(root, { recursive: true });
    writeExtensionManifest(root);
    const eventBus = { emitEnvelope: vi.fn() };
    const ingress = new Ingress();
    let config = { channels: { "fake-channel": { enabled: false } } } as never;
    const runtime = new ExtensionRuntimeService({
      diagnostics: createDiagnostics(),
      eventBus,
      getConfig: () => config,
      getWorkspace: () => workspace,
      ingress,
      messageBus: { publishInbound: vi.fn(async () => undefined) },
      sessionManager,
    });
    runtime.registerIngressHandlers();
    const contributions = await runtime.loadChannelContributions({
      config,
      workspace,
    });
    await runtime.start({ endpoint: "http://127.0.0.1:55667" });
    expect(spawnMock).not.toHaveBeenCalled();

    const binding = contributions.channelBindings.find(
      (entry) => entry.extensionId === "fake-extension",
    );
    expect(binding).toEqual(
      expect.objectContaining({
        extensionId: "fake-extension",
        channelId: "fake-channel",
      }),
    );
    const startPromise = binding?.channel.auth?.start?.({
      cfg: {} as never,
      extensionId: binding.extensionId,
      channelId: binding.channelId,
      channelConfig: { enabled: false },
      accountId: null,
      baseUrl: null,
    });
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const spawned = await markSpawnedExtensionReady(ingress);
    await vi.waitFor(() =>
      expect(eventBus.emitEnvelope).toHaveBeenCalledTimes(1),
    );
    const event = eventBus.emitEnvelope.mock.calls[0]?.[0];
    expect(event).toEqual(
      expect.objectContaining({
        type: "extension.request",
        payload: expect.objectContaining({
          extensionId: "fake-extension",
          generation: spawned.generation,
          kind: "channel.auth.start",
        }),
      }),
    );

    await ingress.handle(
      {
        type: "extension.response",
        extensionId: "fake-extension",
        generation: spawned.generation,
        payload: {
          requestId: event?.payload?.requestId,
          ok: true,
          data: {
            channel: "fake-channel",
            kind: "qr_code",
            sessionId: "session-1",
            qrCode: "qr",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        },
      },
      { source: "test", token: spawned.token },
    );

    await expect(startPromise).resolves.toEqual(
      expect.objectContaining({ sessionId: "session-1" }),
    );
    expect(spawnMock).toHaveBeenCalledTimes(1);

    eventBus.emitEnvelope.mockClear();
    const pollPromise = binding?.channel.auth?.poll?.({
      cfg: {} as never,
      extensionId: binding.extensionId,
      channelId: binding.channelId,
      channelConfig: { enabled: false },
      sessionId: "session-1",
    });
    await vi.waitFor(() =>
      expect(eventBus.emitEnvelope).toHaveBeenCalledTimes(1),
    );
    const pollEvent = eventBus.emitEnvelope.mock.calls[0]?.[0];
    expect(pollEvent?.payload?.generation).toBe(spawned.generation);
    await ingress.handle(
      {
        type: "extension.response",
        extensionId: "fake-extension",
        generation: spawned.generation,
        payload: {
          requestId: pollEvent?.payload?.requestId,
          ok: true,
          data: {
            channel: "fake-channel",
            status: "authorized",
            channelConfig: { enabled: true },
          },
        },
      },
      { source: "test", token: spawned.token },
    );
    await expect(pollPromise).resolves.toEqual(
      expect.objectContaining({ status: "authorized" }),
    );
    config = { channels: { "fake-channel": { enabled: true } } } as never;
    await runtime.loadChannelContributions({ config, workspace });
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it("reconciles config enable and disable without restarting the host", async () => {
    spawnMock.mockImplementation(() => createFakeChildProcess(5004));
    const workspace = createTempDir();
    const root = join(workspace, ".nextclaw", "extensions");
    mkdirSync(root, { recursive: true });
    writeExtensionManifest(root);
    const ingress = new Ingress();
    let config = { channels: { "fake-channel": { enabled: false } } } as never;
    const runtime = new ExtensionRuntimeService({
      diagnostics: createDiagnostics(),
      eventBus: { emitEnvelope: vi.fn() },
      getConfig: () => config,
      getWorkspace: () => workspace,
      ingress,
      messageBus: { publishInbound: vi.fn(async () => undefined) },
      sessionManager,
    });
    runtime.registerIngressHandlers();
    await runtime.loadChannelContributions({ config, workspace });
    await runtime.start({ endpoint: "http://127.0.0.1:55667" });
    expect(spawnMock).not.toHaveBeenCalled();

    config = { channels: { "fake-channel": { enabled: true } } } as never;
    const enabled = runtime.loadChannelContributions({ config, workspace });
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const child = spawnMock.mock.results[0]?.value as FakeChildProcess;
    await markSpawnedExtensionReady(ingress);
    await enabled;

    vi.useFakeTimers();
    config = { channels: { "fake-channel": { enabled: false } } } as never;
    await runtime.loadChannelContributions({ config, workspace });
    expect(child.kill).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

});

describe("ExtensionRuntimeService observation requests", () => {
  it("discovers declared observation capabilities and routes authenticated read requests", async () => {
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

    expect(runtime.observations.discoverObservations()).toEqual([
      expect.objectContaining({
        extensionId: "fake-extension",
        kind: "context",
        description: "Read fake state",
        configSchema: { type: "object" },
      }),
      expect.objectContaining({
        extensionId: "fake-extension",
        kind: "events",
        replay: "supported",
      }),
    ]);
    expect(
      runtime.observations.discoverObservations({
        kinds: ["events"],
        query: "watch",
      }),
    ).toEqual([expect.objectContaining({ kind: "events" })]);
    await expect(
      runtime.observations.readObservation({
        extensionId: "missing-extension",
        config: {},
      }),
    ).rejects.toThrow("Extension not found: missing-extension");

    const read = runtime.observations.readObservation({
      extensionId: "fake-extension",
      config: { resource: "payments" },
    });
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const spawned = await markSpawnedExtensionReady(ingress);
    await vi.waitFor(() =>
      expect(eventBus.emitEnvelope).toHaveBeenCalledTimes(1),
    );
    const request = eventBus.emitEnvelope.mock.calls[0]?.[0];
    expect(request).toEqual(
      expect.objectContaining({
        type: "extension.request",
        payload: expect.objectContaining({
          extensionId: "fake-extension",
          generation: spawned.generation,
          kind: "observation.read",
          payload: { config: { resource: "payments" } },
        }),
      }),
    );
    await ingress.handle(
      {
        type: "extension.response",
        extensionId: "fake-extension",
        generation: spawned.generation,
        payload: {
          requestId: request?.payload?.requestId,
          ok: true,
          data: { version: 2 },
        },
      },
      { source: "test", token: spawned.token },
    );
    await expect(read).resolves.toEqual({ version: 2 });
  });

  it("forwards outbound reply context through the enabled extension generation", async () => {
    spawnMock.mockImplementation(() => createFakeChildProcess(5002));
    const workspace = createTempDir();
    const root = join(workspace, ".nextclaw", "extensions");
    mkdirSync(root, { recursive: true });
    writeExtensionManifest(root);
    const eventBus = { emitEnvelope: vi.fn() };
    const ingress = new Ingress();
    const config = { channels: { "fake-channel": { enabled: true } } } as never;
    const runtime = new ExtensionRuntimeService({
      diagnostics: createDiagnostics(),
      eventBus,
      getConfig: () => config,
      getWorkspace: () => workspace,
      ingress,
      messageBus: { publishInbound: vi.fn(async () => undefined) },
      sessionManager,
    });
    runtime.registerIngressHandlers();
    const contributions = await runtime.loadChannelContributions({
      config,
      workspace,
    });
    const started = runtime.start({ endpoint: "http://127.0.0.1:55667" });
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const spawned = await markSpawnedExtensionReady(ingress);
    await started;
    eventBus.emitEnvelope.mockClear();

    const binding = contributions.channelBindings.find(
      (entry) => entry.extensionId === "fake-extension",
    );
    const sendPromise = binding?.channel.outbound?.sendText?.({
      cfg: {} as never,
      to: "chat-1",
      text: "hello",
      accountId: "account-1",
      replyTo: "message-1",
      media: ["asset-1"],
      metadata: {
        qq: { messageType: "group", groupId: "group-1", userId: "user-1" },
      },
    });
    await vi.waitFor(() =>
      expect(eventBus.emitEnvelope).toHaveBeenCalledTimes(1),
    );
    const event = eventBus.emitEnvelope.mock.calls[0]?.[0];
    expect(event).toEqual(
      expect.objectContaining({
        type: "extension.request",
        payload: expect.objectContaining({
          extensionId: "fake-extension",
          generation: spawned.generation,
          kind: "channel.outbound.sendText",
          payload: expect.objectContaining({
            channelId: "fake-channel",
            to: "chat-1",
            replyTo: "message-1",
            media: ["asset-1"],
          }),
        }),
      }),
    );
    await ingress.handle(
      {
        type: "extension.response",
        extensionId: "fake-extension",
        generation: spawned.generation,
        payload: {
          requestId: event?.payload?.requestId,
          ok: true,
          data: { accepted: true },
        },
      },
      { source: "test", token: spawned.token },
    );
    await expect(sendPromise).resolves.toEqual({ accepted: true });
  });
});
