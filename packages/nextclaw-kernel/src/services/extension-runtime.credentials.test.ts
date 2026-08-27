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
import { createDesktopRuntimeOptions, createDiagnostics, createFakeChildProcess, createTempDir, markSpawnedExtensionReady, readSpawnedExtension, sessionManager, spawnMock, writeExtensionManifest } from "./extension-runtime.test-fixtures.js";
import "./extension-runtime.test-fixtures.js";

describe("ExtensionRuntimeService event stream credentials", () => {
  it("binds credentials to the current extension generation", async () => {
    spawnMock.mockImplementation(() => createFakeChildProcess(5003));
    const workspace = createTempDir();
    const root = join(workspace, ".nextclaw", "extensions");
    mkdirSync(root, { recursive: true });
    writeExtensionManifest(root);
    const ingress = new Ingress();
    const config = { channels: { "fake-channel": { enabled: true } } } as never;
    const diagnostics = createDiagnostics();
    const runtime = new ExtensionRuntimeService({
      ...createDesktopRuntimeOptions(workspace),
      diagnostics,
      eventBus: { emitEnvelope: vi.fn() },
      getConfig: () => config,
      getWorkspace: () => workspace,
      ingress,
      messageBus: { publishInbound: vi.fn(async () => undefined) },
      sessionManager,
    });
    runtime.registerIngressHandlers();
    await runtime.loadChannelContributions({ config, workspace });
    const started = runtime.start({ endpoint: "http://127.0.0.1:55667" });
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const spawned = readSpawnedExtension();

    expect(
      runtime.authenticateEventStreamCredential({
        extensionId: "fake-extension",
        generation: spawned.generation,
        token: spawned.token,
      }),
    ).toEqual({
      extensionId: "fake-extension",
      generation: spawned.generation,
    });
    expect(
      runtime.authenticateEventStreamCredential({
        extensionId: "fake-extension",
        generation: "stale-generation",
        token: spawned.token,
      }),
    ).toBeNull();
    await expect(
      ingress.handle(
        {
          type: "extension.channel.config.get",
          extensionId: "fake-extension",
          generation: "stale-generation",
          payload: { channelId: "fake-channel" },
        },
        {
          source: "test",
          token: spawned.token,
        },
      ),
    ).rejects.toThrow("Unauthorized ingress token");
    await markSpawnedExtensionReady(ingress);
    await started;
    vi.mocked(diagnostics.record).mockClear();
    await ingress.handle(
      {
        type: "extension.diagnostic.emit",
        extensionId: "fake-extension",
        generation: spawned.generation,
        payload: {
          domain: "channel.delivery",
          event: "inbound.observed",
          component: "extension.fake",
          outcome: "observed",
          correlationId: "trace-1",
          facts: { channel: "fake-channel" },
        },
      },
      { source: "test", token: spawned.token },
    );
    expect(diagnostics.record).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: "channel.delivery",
        correlationId: "trace-1",
        facts: expect.objectContaining({
          extensionId: "fake-extension",
          generation: spawned.generation,
        }),
      }),
    );
  });
});
