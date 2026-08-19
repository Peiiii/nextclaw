import type * as ChildProcessModule from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ingress } from "@nextclaw/shared";
import type { DiagnosticRuntime } from "@nextclaw/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ExtensionLifecycleService,
  ExtensionManifestDiscoveryService,
  resolveBuiltinExtensionManifestRoots,
  resolveExtensionManifestRoots,
  resolvePackagedExtensionManifestRoots,
} from "@kernel/features/extension-runtime/index.js";
import {
  ExtensionRuntimeService,
} from "./extension-runtime.service.js";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof ChildProcessModule>();
  return {
    ...actual,
    spawn: spawnMock
  };
});

const tempDirs: string[] = [];

const sessionManager = {} as never;

function createDiagnostics(): DiagnosticRuntime {
  return {
    record: vi.fn((event) => event),
    readCorrelationId: vi.fn(() => undefined),
  } as unknown as DiagnosticRuntime;
}

type FakeChildProcess = EventEmitter & {
  pid: number;
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
  kill: ReturnType<typeof vi.fn>;
};

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-kernel-extension-runtime-test-"));
  tempDirs.push(dir);
  return dir;
}

function createFakeChildProcess(pid: number): FakeChildProcess {
  const child = new EventEmitter() as FakeChildProcess;
  child.pid = pid;
  child.exitCode = null;
  child.signalCode = null;
  child.kill = vi.fn();
  return child;
}

function readSpawnedExtension(callIndex = spawnMock.mock.calls.length - 1): {
  extensionId: string;
  generation: string;
  pid: number;
  token: string;
} {
  const [, , options] = spawnMock.mock.calls[callIndex] as unknown as [
    string,
    string[],
    { env: NodeJS.ProcessEnv },
  ];
  const child = spawnMock.mock.results[callIndex]?.value as FakeChildProcess;
  return {
    extensionId: String(options.env.NEXTCLAW_EXTENSION_ID),
    generation: String(options.env.NEXTCLAW_EXTENSION_GENERATION),
    pid: child.pid,
    token: String(options.env.NEXTCLAW_EXTENSION_TOKEN),
  };
}

async function markSpawnedExtensionReady(ingress: Ingress, callIndex?: number): Promise<{
  extensionId: string;
  generation: string;
  pid: number;
  token: string;
}> {
  const spawned = readSpawnedExtension(callIndex);
  await ingress.handle({
    type: "extension.runtime.ready",
    extensionId: spawned.extensionId,
    generation: spawned.generation,
    payload: {
      generation: spawned.generation,
      pid: spawned.pid,
    },
  }, {
    source: "test",
    token: spawned.token,
  });
  return spawned;
}

function writeExtensionManifest(root: string): void {
  const extensionDir = join(root, "fake-extension");
  mkdirSync(extensionDir);
  writeFileSync(join(extensionDir, "nextclaw.extension.json"), JSON.stringify({
    id: "fake-extension",
    name: "Fake Extension",
    server: {
      type: "stdio",
      command: "node",
      args: ["dist/index.js"],
    },
    contributes: {
      channels: [{
        id: "fake-channel",
        name: "Fake Channel",
        description: "Fake channel",
        auth: true,
        configSchema: { type: "object" },
        configUiHints: {
          enabled: { label: "Enabled" },
        },
      }],
    },
  }));
}

afterEach(() => {
  vi.useRealTimers();
  spawnMock.mockReset();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("resolveExtensionManifestRoots", () => {
  it("includes bundled extension packages so production service installs can discover them", () => {
    const roots = resolveBuiltinExtensionManifestRoots();

    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-dingtalk"))).toBe(true);
    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-discord"))).toBe(true);
    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-email"))).toBe(true);
    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-slack"))).toBe(true);
    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-telegram"))).toBe(true);
    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-wecom"))).toBe(true);
    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-whatsapp"))).toBe(true);
    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-weixin"))).toBe(true);
    expect(roots.some((root) => root.endsWith("nextclaw-channel-extension-qq"))).toBe(true);
  });

  it("uses NextClaw extension directories", () => {
    const workspace = createTempDir();
    const roots = resolveExtensionManifestRoots({
      workspace,
      config: {} as never,
    });

    expect(roots).toContain(join(workspace, ".nextclaw", "extensions"));
  });

  it("keeps explicit packaged extension roots when builtin discovery is disabled", () => {
    const workspace = createTempDir();
    const packagedRoot = createTempDir();
    const originalPackagedRoot = process.env.NEXTCLAW_PACKAGED_EXTENSION_DIR;
    const originalDisableBuiltins = process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS;
    process.env.NEXTCLAW_PACKAGED_EXTENSION_DIR = packagedRoot;
    process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS = "1";

    try {
      expect(resolveBuiltinExtensionManifestRoots()).toEqual([]);
      expect(resolvePackagedExtensionManifestRoots()).toEqual([packagedRoot]);
      expect(resolveExtensionManifestRoots({
        workspace,
        config: {} as never,
      })).toContain(packagedRoot);
    } finally {
      if (originalPackagedRoot === undefined) {
        delete process.env.NEXTCLAW_PACKAGED_EXTENSION_DIR;
      } else {
        process.env.NEXTCLAW_PACKAGED_EXTENSION_DIR = originalPackagedRoot;
      }
      if (originalDisableBuiltins === undefined) {
        delete process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS;
      } else {
        process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS = originalDisableBuiltins;
      }
    }
  });
});

describe("ExtensionLifecycleService", () => {
  it("cleans orphan extension processes before spawning extensions", async () => {
    const root = createTempDir();
    const cleanupOrphanProcesses = vi.fn();
    spawnMock.mockImplementation(() => createFakeChildProcess(4321));
    const manifest = {
      id: "fake-extension",
      rootDir: root,
      server: {
        type: "stdio",
        command: "node",
        args: ["dist/index.js"],
      },
    } as const;
    const lifecycle = new ExtensionLifecycleService({ cleanupOrphanProcesses });

    const acquired = lifecycle.acquire(manifest, {
      endpoint: "http://127.0.0.1:55667",
      reason: { kind: "enabled-channel", channelId: "fake-channel" },
    });

    expect(cleanupOrphanProcesses.mock.invocationCallOrder[0]).toBeLessThan(spawnMock.mock.invocationCallOrder[0] ?? 0);
    expect(cleanupOrphanProcesses).toHaveBeenCalledWith([manifest]);
    const [, , options] = spawnMock.mock.calls[0] as unknown as [string, string[], { env: NodeJS.ProcessEnv }];
    lifecycle.markReady({
      extensionId: manifest.id,
      generation: String(options.env.NEXTCLAW_EXTENSION_GENERATION),
      pid: 4321,
    });
    await acquired;
  });

  it("passes generation-scoped credentials and the service pid to spawned extension processes", async () => {
    const root = createTempDir();
    spawnMock.mockImplementation(() => createFakeChildProcess(4321));
    const lifecycle = new ExtensionLifecycleService({ cleanupOrphanProcesses: () => undefined });

    const acquired = lifecycle.acquire({
      id: "fake-extension",
      rootDir: root,
      server: {
        type: "stdio",
        command: "node",
        args: ["dist/index.js"],
      },
    }, {
      endpoint: "http://127.0.0.1:55667",
      reason: { kind: "enabled-channel", channelId: "fake-channel" },
    });

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [, , options] = spawnMock.mock.calls[0] as unknown as [string, string[], { env: NodeJS.ProcessEnv }];
    expect(options.env).toEqual(expect.objectContaining({
      NEXTCLAW_EXTENSION_ID: "fake-extension",
      NEXTCLAW_EXTENSION_ENDPOINT: "http://127.0.0.1:55667",
      NEXTCLAW_EXTENSION_GENERATION: expect.any(String),
      NEXTCLAW_EXTENSION_PARENT_PID: String(process.pid),
      NEXTCLAW_EXTENSION_TOKEN: expect.any(String),
    }));
    lifecycle.markReady({
      extensionId: "fake-extension",
      generation: String(options.env.NEXTCLAW_EXTENSION_GENERATION),
      pid: 4321,
    });
    await acquired;
  });

  it("shares one spawn and ready promise across twenty concurrent leases", async () => {
    const root = createTempDir();
    spawnMock.mockImplementation(() => createFakeChildProcess(4322));
    const lifecycle = new ExtensionLifecycleService({ cleanupOrphanProcesses: () => undefined });
    const manifest = {
      id: "fake-extension",
      rootDir: root,
      server: { type: "stdio", command: "node", args: ["dist/index.js"] },
    } as const;

    const acquired = Array.from({ length: 20 }, (_, index) => lifecycle.acquire(manifest, {
      endpoint: "http://127.0.0.1:55667",
      reason: { kind: "request", requestId: `request-${index}` },
    }));
    expect(spawnMock).toHaveBeenCalledTimes(1);
    const spawned = readSpawnedExtension(0);
    lifecycle.markReady({
      extensionId: spawned.extensionId,
      generation: spawned.generation,
      pid: spawned.pid,
    });
    const leases = await Promise.all(acquired);

    expect(new Set(leases.map((lease) => lease.generation))).toEqual(new Set([spawned.generation]));
    expect(lifecycle.getStatus()[0]?.leaseReasons).toHaveLength(20);
  });

  it("stops the process after the final lease grace period", async () => {
    vi.useFakeTimers();
    const root = createTempDir();
    const child = createFakeChildProcess(4323);
    spawnMock.mockReturnValue(child);
    const lifecycle = new ExtensionLifecycleService({
      cleanupOrphanProcesses: () => undefined,
      stopGraceMs: 30,
    });
    const acquired = lifecycle.acquire({
      id: "fake-extension",
      rootDir: root,
      server: { type: "stdio", command: "node", args: ["dist/index.js"] },
    }, {
      endpoint: "http://127.0.0.1:55667",
      reason: { kind: "request", requestId: "request-1" },
    });
    const spawned = readSpawnedExtension();
    lifecycle.markReady({
      extensionId: spawned.extensionId,
      generation: spawned.generation,
      pid: spawned.pid,
    });
    const lease = await acquired;
    lease.release();

    await vi.advanceTimersByTimeAsync(29);
    expect(child.kill).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  it("rotates generation credentials after a crash and rejects stale ready signals", async () => {
    const root = createTempDir();
    const children = [createFakeChildProcess(4324), createFakeChildProcess(4325)];
    spawnMock.mockImplementation(() => children.shift());
    const lifecycle = new ExtensionLifecycleService({
      cleanupOrphanProcesses: () => undefined,
      restartDelaysMs: [0],
    });
    const acquired = lifecycle.acquire({
      id: "fake-extension",
      rootDir: root,
      server: { type: "stdio", command: "node", args: ["dist/index.js"] },
    }, {
      endpoint: "http://127.0.0.1:55667",
      reason: { kind: "enabled-channel", channelId: "fake-channel" },
    });
    const first = readSpawnedExtension();
    lifecycle.markReady({ extensionId: first.extensionId, generation: first.generation, pid: first.pid });
    await acquired;
    (spawnMock.mock.results[0]?.value as FakeChildProcess).emit("exit", 1, null);
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(2));
    const second = readSpawnedExtension(1);

    expect(second.generation).not.toBe(first.generation);
    expect(second.token).not.toBe(first.token);
    expect(lifecycle.authenticateCredential({
      extensionId: first.extensionId,
      generation: first.generation,
      token: first.token,
    })).toBeNull();
    expect(() => lifecycle.markReady({
      extensionId: first.extensionId,
      generation: first.generation,
      pid: first.pid,
    })).toThrow("Stale extension ready signal rejected");
    lifecycle.markReady({ extensionId: second.extensionId, generation: second.generation, pid: second.pid });
  });
});

describe("ExtensionRuntimeService", () => {
  it("deduplicates extension manifests by id across discovery roots", async () => {
    const rootA = createTempDir();
    const rootB = createTempDir();
    writeExtensionManifest(rootA);
    writeExtensionManifest(rootB);

    const manifests = await new ExtensionManifestDiscoveryService().discover([rootA, rootB]);

    expect(manifests.map((manifest) => manifest.id)).toEqual(["fake-extension"]);
  });

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
    const contributions = await runtime.loadChannelContributions({ config, workspace });
    await runtime.start({ endpoint: "http://127.0.0.1:55667" });
    expect(spawnMock).not.toHaveBeenCalled();

    const binding = contributions.channelBindings.find((entry) => entry.extensionId === "fake-extension");
    expect(binding).toEqual(expect.objectContaining({
      extensionId: "fake-extension",
      channelId: "fake-channel",
    }));
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
    await vi.waitFor(() => expect(eventBus.emitEnvelope).toHaveBeenCalledTimes(1));
    const event = eventBus.emitEnvelope.mock.calls[0]?.[0];
    expect(event).toEqual(expect.objectContaining({
      type: "extension.request",
      payload: expect.objectContaining({
        extensionId: "fake-extension",
        generation: spawned.generation,
        kind: "channel.auth.start",
      }),
    }));

    await ingress.handle({
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
    }, { source: "test", token: spawned.token });

    await expect(startPromise).resolves.toEqual(expect.objectContaining({ sessionId: "session-1" }));
    expect(spawnMock).toHaveBeenCalledTimes(1);

    eventBus.emitEnvelope.mockClear();
    const pollPromise = binding?.channel.auth?.poll?.({
      cfg: {} as never,
      extensionId: binding.extensionId,
      channelId: binding.channelId,
      channelConfig: { enabled: false },
      sessionId: "session-1",
    });
    await vi.waitFor(() => expect(eventBus.emitEnvelope).toHaveBeenCalledTimes(1));
    const pollEvent = eventBus.emitEnvelope.mock.calls[0]?.[0];
    expect(pollEvent?.payload?.generation).toBe(spawned.generation);
    await ingress.handle({
      type: "extension.response",
      extensionId: "fake-extension",
      generation: spawned.generation,
      payload: {
        requestId: pollEvent?.payload?.requestId,
        ok: true,
        data: { channel: "fake-channel", status: "authorized", channelConfig: { enabled: true } },
      },
    }, { source: "test", token: spawned.token });
    await expect(pollPromise).resolves.toEqual(expect.objectContaining({ status: "authorized" }));
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
    const contributions = await runtime.loadChannelContributions({ config, workspace });
    const started = runtime.start({ endpoint: "http://127.0.0.1:55667" });
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1));
    const spawned = await markSpawnedExtensionReady(ingress);
    await started;
    eventBus.emitEnvelope.mockClear();

    const binding = contributions.channelBindings.find((entry) => entry.extensionId === "fake-extension");
    const sendPromise = binding?.channel.outbound?.sendText?.({
      cfg: {} as never,
      to: "chat-1",
      text: "hello",
      accountId: "account-1",
      replyTo: "message-1",
      media: ["asset-1"],
      metadata: { qq: { messageType: "group", groupId: "group-1", userId: "user-1" } },
    });
    await vi.waitFor(() => expect(eventBus.emitEnvelope).toHaveBeenCalledTimes(1));
    const event = eventBus.emitEnvelope.mock.calls[0]?.[0];
    expect(event).toEqual(expect.objectContaining({
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
    }));
    await ingress.handle({
      type: "extension.response",
      extensionId: "fake-extension",
      generation: spawned.generation,
      payload: { requestId: event?.payload?.requestId, ok: true, data: { accepted: true } },
    }, { source: "test", token: spawned.token });
    await expect(sendPromise).resolves.toEqual({ accepted: true });
  });
});

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

    expect(runtime.authenticateEventStreamCredential({
      extensionId: "fake-extension",
      generation: spawned.generation,
      token: spawned.token,
    })).toEqual({ extensionId: "fake-extension", generation: spawned.generation });
    expect(runtime.authenticateEventStreamCredential({
      extensionId: "fake-extension",
      generation: "stale-generation",
      token: spawned.token,
    })).toBeNull();
    await expect(ingress.handle({
      type: "extension.channel.config.get",
      extensionId: "fake-extension",
      generation: "stale-generation",
      payload: { channelId: "fake-channel" },
    }, {
      source: "test",
      token: spawned.token,
    })).rejects.toThrow("Unauthorized ingress token");
    await markSpawnedExtensionReady(ingress);
    await started;
    vi.mocked(diagnostics.record).mockClear();
    await ingress.handle({
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
    }, { source: "test", token: spawned.token });
    expect(diagnostics.record).toHaveBeenCalledWith(expect.objectContaining({
      domain: "channel.delivery",
      correlationId: "trace-1",
      facts: expect.objectContaining({
        extensionId: "fake-extension",
        generation: spawned.generation,
      }),
    }));
  });
});
