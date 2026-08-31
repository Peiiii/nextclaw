import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PortableServiceAppRuntimeService } from "./portable-service-app-runtime.service.js";
import type {
  ServiceAppManifest,
  ServiceAppRecord,
} from "@kernel/types/service-app.types.js";
import type { ServiceAppJobEventSink } from "./service-app-job-journal.service.js";
import {
  AppHomeService,
  AppInstanceStorageService,
  AppRegistryService,
} from "@nextclaw/app-runtime";
import type { Config } from "@nextclaw/core";

const REPOSITORY_ROOT = path.resolve(process.cwd(), "../..");
const RUNNER_PATH = path.join(
  REPOSITORY_ROOT,
  `packages/nextclaw/resources/native/${process.platform}-${process.arch}`,
  process.platform === "win32"
    ? "nextclaw-wasmtime-runner.exe"
    : "nextclaw-wasmtime-runner",
);
const APP_ROOT = path.join(
  REPOSITORY_ROOT,
  "packages/nextclaw/resources/apps/nextclaw-portable-runtime-lab/service-components",
);

let dataRoot: string;
let runtime: PortableServiceAppRuntimeService;
let previousRunnerPath: string | undefined;

beforeEach(async () => {
  dataRoot = await mkdtemp(
    path.join(os.tmpdir(), "nextclaw-portable-runtime-"),
  );
  previousRunnerPath = process.env.NEXTCLAW_WASMTIME_RUNNER_PATH;
  process.env.NEXTCLAW_WASMTIME_RUNNER_PATH = RUNNER_PATH;
  runtime = new PortableServiceAppRuntimeService();
});

afterEach(async () => {
  await runtime.dispose();
  await rm(dataRoot, { recursive: true, force: true });
  if (previousRunnerPath === undefined) {
    delete process.env.NEXTCLAW_WASMTIME_RUNNER_PATH;
  } else {
    process.env.NEXTCLAW_WASMTIME_RUNNER_PATH = previousRunnerPath;
  }
});

describe("PortableServiceAppRuntimeService", () => {
  it("resolves bound Secrets only into the private runner request, rotates its lane, and fails closed after revoke", async () => {
    await runtime.dispose();
    delete process.env.NEXTCLAW_WASMTIME_RUNNER_PATH;
    const appId = "nextclaw.portable-secret-test";
    const appHomeDirectory = path.join(dataRoot, "app-home");
    const appHome = new AppHomeService(appHomeDirectory);
    const registry = new AppRegistryService(appHome);
    const instance = await new AppInstanceStorageService(appHome)
      .materializeDefaultInstance({ appId, dataSchemaVersion: 1 });
    const installDirectory = appHome.getInstallDirectory(appId, "1.0.0");
    await registry.upsertInstallation({
      appId,
      name: "Portable Secret test",
      version: "1.0.0",
      installDirectory,
      defaultInstance: instance,
      sourceKind: "directory",
      sourceRef: installDirectory,
      installedAt: new Date().toISOString(),
      permissions: {
        secrets: [{
          id: "api-token",
          title: "API Token",
          description: "test slot",
          required: true,
        }],
      },
      manifestSchemaVersion: 2,
      components: [],
      dataSchemaVersion: 1,
      security: {
        runtimeProfile: "wasi",
        isolation: "host-mediated",
        hasServiceComponents: true,
        inferred: false,
        permissions: {
          secrets: [{
            id: "api-token",
            title: "API Token",
            description: "test slot",
            required: true,
          }],
        },
      },
    });
    const secretEnvKey = "NEXTCLAW_PORTABLE_SECRET_TEST";
    const firstSecret = "test-secret-one";
    const secondSecret = "test-secret-two";
    const previousSecret = process.env[secretEnvKey];
    process.env[secretEnvKey] = firstSecret;
    runtime = new PortableServiceAppRuntimeService({
      appHomeDirectory,
      runnerPath: await createSecretEchoRunner(dataRoot, firstSecret, secondSecret),
      getSecretConfig: () => ({
        secrets: { enabled: true, defaults: {}, providers: {}, refs: {} },
      }) as Config,
    });
    const app: ServiceAppRecord = {
      id: "nextclaw-portable-secret-test-service",
      title: "Portable Secret test",
      dirPath: installDirectory,
      manifestPath: path.join(installDirectory, "service-app.json"),
      cwd: installDirectory,
      enabled: true,
      protocol: "wasi-component",
      status: "idle",
      sourceKind: "package",
      packageId: appId,
      packageVersion: "1.0.0",
      componentPath: path.join(installDirectory, "service.wasm"),
      dataDirectory: instance.storage.dataDirectory,
      storage: instance.storage,
      runtimeProfile: "wasi",
      isolation: "host-mediated",
      permissions: {
        secrets: [{
          id: "api-token",
          title: "API Token",
          description: "test slot",
          required: true,
        }],
      },
    };
    const manifest: ServiceAppManifest = {
      id: app.id,
      title: app.title,
      enabled: true,
      protocol: "wasi-component",
      lifecycle: { mode: "action" },
      actions: { verify: { risk: "read" } },
    };

    await expect(runtime.invokeAction({ app, manifest, actionName: "verify", input: {} }))
      .rejects.toMatchObject({ code: "SECRET_BINDING_MISSING" });

    await registry.bindSecret(appId, "api-token", { source: "env", id: secretEnvKey });
    const bound = await runtime.invokeAction({ app, manifest, actionName: "verify", input: {} }) as {
      accepted: boolean;
      secretLeaked: boolean;
      stopCount: number;
      slots: string[];
      fingerprintLength: number;
    };
    expect(bound).toMatchObject({
      accepted: true,
      secretLeaked: false,
      stopCount: 0,
      slots: ["nextclaw_secret_6170692d746f6b656e"],
      fingerprintLength: 64,
    });
    expect(JSON.stringify(bound)).not.toContain(firstSecret);

    process.env[secretEnvKey] = secondSecret;
    const rotated = await runtime.invokeAction({ app, manifest, actionName: "verify", input: {} }) as {
      accepted: boolean;
      secretLeaked: boolean;
      stopCount: number;
    };
    expect(rotated).toMatchObject({ accepted: true, secretLeaked: false, stopCount: 1 });
    expect(JSON.stringify(rotated)).not.toContain(secondSecret);

    await registry.unbindSecret(appId, "api-token");
    await expect(runtime.invokeAction({ app, manifest, actionName: "verify", input: {} }))
      .rejects.toMatchObject({ code: "SECRET_BINDING_MISSING" });
    expect(runtime.getStatus(app.id)).toEqual({ status: "idle" });

    await registry.bindSecret(appId, "api-token", { source: "env", id: `${secretEnvKey}_MISSING` });
    await expect(runtime.invokeAction({ app, manifest, actionName: "verify", input: {} }))
      .rejects.toMatchObject({ code: "SECRET_RESOLUTION_FAILED" });

    if (previousSecret === undefined) delete process.env[secretEnvKey];
    else process.env[secretEnvKey] = previousSecret;
  });

});

describe("PortableServiceAppRuntimeService capability snapshots", () => {
  it("projects only current schema v2 grants into canonical, mode-limited filesystem mounts", async () => {
    await runtime.dispose();
    delete process.env.NEXTCLAW_WASMTIME_RUNNER_PATH;
    const appId = "nextclaw.filesystem-test";
    const appHomeDirectory = path.join(dataRoot, "app-home");
    const appHome = new AppHomeService(appHomeDirectory);
    const registry = new AppRegistryService(appHome);
    const instance = await new AppInstanceStorageService(
      appHome,
    ).materializeDefaultInstance({ appId, dataSchemaVersion: 1 });
    const packageDirectory = appHome.getInstallDirectory(appId, "1.0.0");
    const realNotes = path.join(dataRoot, "real-notes");
    const grantedNotes = path.join(dataRoot, "granted-notes");
    const writableInbox = path.join(dataRoot, "inbox");
    await Promise.all([
      mkdir(path.join(packageDirectory, "assets"), { recursive: true }),
      mkdir(realNotes, { recursive: true }),
      mkdir(writableInbox, { recursive: true }),
    ]);
    await writeFile(
      path.join(packageDirectory, "assets", "fixture.txt"),
      "asset\n",
    );
    await symlink(realNotes, grantedNotes);
    await registry.upsertInstallation({
      appId,
      name: "Filesystem test",
      version: "1.0.0",
      installDirectory: packageDirectory,
      defaultInstance: instance,
      sourceKind: "directory",
      sourceRef: packageDirectory,
      installedAt: new Date().toISOString(),
      permissions: {
        documentAccess: [
          { id: "notes", mode: "read" },
          { id: "inbox", mode: "read-write" },
        ],
      },
      manifestSchemaVersion: 2,
      components: [],
      dataSchemaVersion: 1,
      security: {
        runtimeProfile: "wasi",
        isolation: "host-mediated",
        hasServiceComponents: true,
        inferred: false,
        permissions: {
          documentAccess: [
            { id: "notes", mode: "read" },
            { id: "inbox", mode: "read-write" },
          ],
        },
      },
    });
    await registry.setDocumentGrant(appId, "notes", grantedNotes);
    await registry.setDocumentGrant(appId, "inbox", writableInbox);
    runtime = new PortableServiceAppRuntimeService({
      appHomeDirectory,
      runnerPath: await createMountEchoRunner(dataRoot),
    });
    const app: ServiceAppRecord = {
      id: "nextclaw-filesystem-test-service",
      title: "Filesystem test",
      dirPath: path.join(packageDirectory, "service-components", "filesystem"),
      manifestPath: path.join(
        packageDirectory,
        "service-components",
        "filesystem",
        "service-app.json",
      ),
      cwd: packageDirectory,
      enabled: true,
      protocol: "wasi-component",
      status: "idle",
      sourceKind: "package",
      packageId: appId,
      packageVersion: "1.0.0",
      packageDirectory,
      componentPath: path.join(
        packageDirectory,
        "service-components",
        "filesystem",
        "service.wasm",
      ),
      dataDirectory: instance.storage.dataDirectory,
      storage: instance.storage,
      runtimeProfile: "wasi",
      isolation: "host-mediated",
      permissions: {
        documentAccess: [
          { id: "notes", mode: "read" },
          { id: "inbox", mode: "read-write" },
        ],
      },
    };
    const manifest: ServiceAppManifest = {
      id: app.id,
      title: app.title,
      enabled: true,
      protocol: "wasi-component",
      lifecycle: { mode: "action" },
      actions: { inspect: { risk: "read" } },
    };

    const initial = (await runtime.invokeAction({
      app,
      manifest,
      actionName: "inspect",
      input: {},
    })) as Array<{ guestPath: string; hostPath: string; writable: boolean }>;
    expect(initial).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ guestPath: "/app", writable: false }),
        expect.objectContaining({ guestPath: "/data", writable: true }),
        expect.objectContaining({ guestPath: "/cache", writable: true }),
        expect.objectContaining({ guestPath: "/tmp", writable: true }),
        expect.objectContaining({
          guestPath: "/documents/notes",
          hostPath: await realpath(realNotes),
          writable: false,
        }),
        expect.objectContaining({
          guestPath: "/documents/inbox",
          writable: true,
        }),
      ]),
    );

    await registry.removeDocumentGrant(appId, "notes");
    const afterRevoke = (await runtime.invokeAction({
      app,
      manifest,
      actionName: "inspect",
      input: {},
    })) as Array<{ guestPath: string }>;
    expect(afterRevoke.map((mount) => mount.guestPath)).not.toContain(
      "/documents/notes",
    );
    expect(afterRevoke.map((mount) => mount.guestPath)).toContain(
      "/documents/inbox",
    );
  });

});

describe("PortableServiceAppRuntimeService execution", () => {
  it("runs two Rust components in one runner with mediated storage and policy denial", async () => {
    const state = createFixture("state");
    const capabilities = createFixture("capabilities");

    await expect(runtime.listActions(state)).resolves.toHaveLength(8);
    await expect(runtime.listActions(capabilities)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "secret_verify" }),
      ]),
    );

    await expect(
      runtime.invokeAction({
        ...state,
        actionName: "counter_increment",
        input: { step: 3 },
      }),
    ).resolves.toMatchObject({ counter: 3, persistedBy: "host.kv" });

    const stateInfo = (await runtime.invokeAction({
      ...state,
      actionName: "runtime_info",
      input: {},
    })) as { runnerPid: number };
    const capabilityInfo = (await runtime.invokeAction({
      ...capabilities,
      actionName: "runtime_info",
      input: {},
    })) as { runnerPid: number; loadedComponents: number };
    expect(capabilityInfo).toMatchObject({
      runnerPid: stateInfo.runnerPid,
      loadedComponents: 2,
    });

    await expect(
      runtime.invokeAction({
        ...capabilities,
        actionName: "network_denied",
        input: {},
      }),
    ).resolves.toMatchObject({
      denied: true,
      reason: expect.stringMatching(/NETWORK_DENIED|HttpRequestDenied/),
    });

    const deniedState = createFixture("state");
    deniedState.app.permissions = {};
    await expect(
      runtime.invokeAction({
        ...deniedState,
        actionName: "counter_read",
        input: {},
      }),
    ).rejects.toThrow("CAPABILITY_DENIED: storage permission is required");
  });

  it("bridges a real WASI Guest model call through the Kernel callback without leaking runner secrets", async () => {
    const capabilities = createFixture("capabilities");
    const secretValue = "kernel-bridge-secret";
    capabilities.app.permissions = { storage: true };
    runtime.setHostCallHandler(async (call) => {
      expect(call.request).toMatchObject({
        capability: "model-complete",
        appId: capabilities.app.id,
        callId: "kernel-call-1",
        traceId: "kernel-trace-1",
      });
      expect(JSON.stringify(call.request)).not.toContain(secretValue);
      return {
        content: "Kernel-mediated model result",
        usage: { totalTokens: 5 },
        correlation: call.request.callId,
      };
    });

    await expect(runtime.invokeAction({
      ...capabilities,
      actionName: "model_complete",
      input: {
        slotId: "summary",
        messages: [{ role: "user", content: "Summarize safely" }],
        maxTokens: 12,
      },
      job: {
        jobId: "kernel-job-1",
        callId: "kernel-call-1",
        traceId: "kernel-trace-1",
        eventSink: {
          reportProgress: async () => undefined,
          emitChunk: async () => undefined,
          recordTerminal: async () => undefined,
        },
      },
    })).resolves.toMatchObject({
      content: "Kernel-mediated model result",
      usage: { totalTokens: 5 },
      correlation: "kernel-call-1",
    });
  });

  it("times out only the over-budget Job and keeps another Action available", async () => {
    const state = createFixture("state");
    const capabilities = createFixture("capabilities");
    await runtime.invokeAction({
      ...state,
      actionName: "counter_increment",
      input: { step: 1 },
    });

    await expect(
      runtime.invokeAction({
        ...capabilities,
        actionName: "simulate_timeout",
        input: {},
      }),
    ).rejects.toMatchObject({ code: "PORTABLE_RUNTIME_TIMEOUT" });

    await expect(
      runtime.invokeAction({
        ...state,
        actionName: "counter_read",
        input: {},
      }),
    ).resolves.toMatchObject({ counter: 1, persistedBy: "host.kv" });
  });

  it("forwards ordered long-Job progress and chunks into the kernel event sink", async () => {
    const capabilities = createFixture("capabilities");
    const events: string[] = [];
    const sink: ServiceAppJobEventSink = {
      reportProgress: async () => { events.push("progress"); return undefined; },
      emitChunk: async () => { events.push("chunk"); return { type: "stream-chunk", sequence: events.length, timestamp: new Date().toISOString(), content: "chunk" }; },
      recordTerminal: async () => {
        events.push("terminal");
        return { id: "job", appId: capabilities.app.id, instanceId: "instance", componentId: capabilities.app.id, actionName: "long_task", status: "succeeded", createdAt: "", updatedAt: "", callId: "call", traceId: "trace" };
      },
    };
    await expect(runtime.invokeAction({
      ...capabilities,
      actionName: "long_task",
      input: {},
      job: { jobId: "long-task-e2e", eventSink: sink },
    })).resolves.toMatchObject({ completed: true, streamed: 2 });
    expect(events).toEqual(["progress", "chunk", "progress", "chunk", "terminal"]);
  });

  it("retains one resident instance, delivers host events, and resumes durable state", async () => {
    const resident = createFixture("resident");
    await runtime.start(resident);
    await expect(runtime.listActions(resident)).resolves.toHaveLength(4);

    const initial = (await runtime.invokeAction({
      ...resident,
      actionName: "resident_status",
      input: {},
    })) as { eventCount: number; instanceEpoch: number };

    await expect
      .poll(
        async () => {
          const status = (await runtime.invokeAction({
            ...resident,
            actionName: "resident_status",
            input: {},
          })) as { eventCount: number };
          return status.eventCount;
        },
        { interval: 100, timeout: 2_000 },
      )
      .toBeGreaterThan(initial.eventCount);

    const beforeRestart = (await runtime.invokeAction({
      ...resident,
      actionName: "resident_status",
      input: {},
    })) as {
      eventCount: number;
      inMemoryEventCount: number;
      instanceEpoch: number;
    };
    // Action calls use an independent Store; the Resident lane owns its
    // in-memory event state and is not exposed through an Action Store.
    expect(beforeRestart.inMemoryEventCount).toBe(0);

    await runtime.stop(resident.app.id);
    await runtime.start(resident);
    const afterRestart = (await runtime.invokeAction({
      ...resident,
      actionName: "resident_status",
      input: {},
    })) as {
      eventCount: number;
      inMemoryEventCount: number;
      instanceEpoch: number;
    };
    // Restart resumes the durable cursor before returning, but the restarted
    // resident lane may also accept its next timer event before this read.
    // The invariant is therefore no durable-event regression, not clock-level
    // equality with the pre-restart sample.
    expect(afterRestart.eventCount).toBeGreaterThanOrEqual(beforeRestart.eventCount);
    expect(afterRestart).toMatchObject({
      inMemoryEventCount: 0,
      instanceEpoch: beforeRestart.instanceEpoch + 1,
    });
  });

  it("uses the durable inbox before the typed v2 Resident lane and never replays one eventId", async () => {
    const resident = createFixture("resident");
    resident.manifest = {
      ...resident.manifest,
      lifecycle: { mode: "resident", eventIntervalMs: 60_000 },
    };
    await runtime.start(resident);
    const event = {
      eventId: "manual-dedupe-1",
      streamKey: "manual",
      payload: { eventId: "manual-dedupe-1", kind: "manual", triggeredAt: "test" },
    };
    await runtime.enqueueResidentEvent({ ...resident, ...event });
    await runtime.enqueueResidentEvent({ ...resident, ...event });
    await expect.poll(async () => (await runtime.invokeAction({
      ...resident, actionName: "resident_status", input: {},
    }) as { eventCount: number }).eventCount, { interval: 50, timeout: 2_000 }).toBe(1);

    await runtime.enqueueResidentEvent({
      ...resident,
      eventId: "manual-retry-1",
      streamKey: "manual",
      payload: { eventId: "manual-retry-1", kind: "retry-once", triggeredAt: "test" },
    });
    // The first delivery asks the host to retry. A new ingress wakes the
    // serial lane; the retried event remains ahead of this later event.
    await runtime.enqueueResidentEvent({
      ...resident,
      eventId: "manual-wakeup-1",
      streamKey: "manual",
      payload: { eventId: "manual-wakeup-1", kind: "manual", triggeredAt: "test" },
    });
    await expect.poll(async () => (await runtime.invokeAction({
      ...resident, actionName: "resident_status", input: {},
    }) as { eventCount: number }).eventCount, { interval: 50, timeout: 2_000 }).toBe(3);
  });
});

describe("PortableServiceAppRuntimeService composition and recovery", () => {
  it("registers a provider and mediates declared cross-component composition", async () => {
    const provider = createFixture("provider");
    const composition = createFixture("composition");
    await runtime.start(provider);

    await expect(
      runtime.invokeAction({
        ...composition,
        actionName: "compose_contact",
        input: {
          name: "  Ada   Lovelace  ",
          email: " ADA@EXAMPLE.COM ",
          tags: ["AI", "ai", "Math"],
        },
      }),
    ).resolves.toMatchObject({
      displayLabel: "Ada Lovelace <ada@example.com>",
      mediatedBy: "host.component-call",
      provider: {
        normalizedTags: ["ai", "math"],
        providerCallCount: 1,
      },
    });

    await expect(
      runtime.invokeAction({
        ...composition,
        actionName: "provider_denied",
        input: {},
      }),
    ).resolves.toMatchObject({
      denied: true,
      reason: expect.stringContaining("PROVIDER_DENIED"),
    });
  });

  it("keeps Provider and Resident roles alive after an unrelated Action timeout", async () => {
    const provider = createFixture("provider");
    const resident = createFixture("resident");
    const capabilities = createFixture("capabilities");
    const composition = createFixture("composition");
    await runtime.start(provider);
    await runtime.start(resident);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const beforeTimeout = (await runtime.invokeAction({
      ...resident,
      actionName: "resident_status",
      input: {},
    })) as { eventCount: number; instanceEpoch: number };

    await expect(
      runtime.invokeAction({
        ...capabilities,
        actionName: "simulate_timeout",
        input: {},
      }),
    ).rejects.toMatchObject({ code: "PORTABLE_RUNTIME_TIMEOUT" });

    await expect(
      runtime.invokeAction({
        ...composition,
        actionName: "compose_contact",
        input: {
          name: "Grace Hopper",
          email: "GRACE@EXAMPLE.COM",
          tags: ["AI"],
        },
      }),
    ).resolves.toMatchObject({
      displayLabel: "Grace Hopper <grace@example.com>",
      mediatedBy: "host.component-call",
    });
    const afterTimeout = (await runtime.invokeAction({
      ...resident,
      actionName: "resident_status",
      input: {},
    })) as { eventCount: number; instanceEpoch: number };
    // The timeout is isolated to its Action Store: the resident survives in
    // the same lane and may keep receiving its own scheduled events.
    expect(afterTimeout).toMatchObject({ instanceEpoch: beforeTimeout.instanceEpoch });
    expect(afterTimeout.eventCount).toBeGreaterThanOrEqual(beforeTimeout.eventCount);
  });

  it("restores Provider and Resident roles after the shared runner exits while idle", async () => {
    const provider = createFixture("provider");
    const resident = createFixture("resident");
    const composition = createFixture("composition");
    await runtime.start(provider);
    await runtime.start(resident);
    const beforeExit = (await runtime.invokeAction({
      ...resident,
      actionName: "resident_status",
      input: {},
    })) as { eventCount: number; instanceEpoch: number };
    const runtimeInfo = (await runtime.invokeAction({
      ...resident,
      actionName: "runtime_info",
      input: {},
    })) as { runnerPid: number };

    process.kill(runtimeInfo.runnerPid, "SIGTERM");

    await expect
      .poll(
        async () => {
          const status = (await runtime.invokeAction({
            ...resident,
            actionName: "resident_status",
            input: {},
          })) as { instanceEpoch: number };
          return status.instanceEpoch;
        },
        { interval: 100, timeout: 3_000 },
      )
      .toBe(beforeExit.instanceEpoch + 1);
    await expect(
      runtime.invokeAction({
        ...composition,
        actionName: "compose_contact",
        input: {
          name: "Katherine Johnson",
          email: "KJ@EXAMPLE.COM",
          tags: ["NASA"],
        },
      }),
    ).resolves.toMatchObject({
      displayLabel: "Katherine Johnson <kj@example.com>",
      mediatedBy: "host.component-call",
    });
  });
});

function createFixture(
  kind: "state" | "capabilities" | "resident" | "provider" | "composition",
): {
  app: ServiceAppRecord;
  manifest: ServiceAppManifest;
} {
  const id = `nextclaw-portable-runtime-lab-${kind}`;
  const componentDirectory = path.join(APP_ROOT, id);
  const actionNames =
    kind === "state"
      ? [
          "counter_read",
          "counter_increment",
          "records_seed",
          "records_list",
          "record_upsert",
          "record_delete",
          "data_snapshot",
          "runtime_info",
        ]
      : kind === "resident"
        ? [
            "resident_status",
            "resident_emit_event",
            "resident_reset",
            "runtime_info",
          ]
        : kind === "provider"
          ? ["contact_normalize", "provider_status", "runtime_info"]
          : kind === "composition"
            ? ["compose_contact", "provider_denied", "runtime_info"]
            : [
                "network_allowed",
                "network_denied",
                "structured_failure",
                "simulate_timeout",
                "runtime_info",
                "filesystem_read",
            "filesystem_write",
                "model_complete",
                "agent_start",
              ];
  return {
    app: {
      id,
      title: id,
      dirPath: componentDirectory,
      manifestPath: path.join(componentDirectory, "service-app.json"),
      cwd: componentDirectory,
      enabled: true,
      protocol: "wasi-component",
      status: "idle",
      sourceKind: "package",
      dataDirectory: path.join(dataRoot, kind),
      componentPath: path.join(componentDirectory, "service.wasm"),
      runtimeProfile: "wasi",
      isolation: "host-mediated",
      permissions: { storage: true, allowedDomains: ["httpbin.org"] },
      providerIds:
        kind === "composition"
          ? ["nextclaw-portable-runtime-lab-provider"]
          : [],
    },
    manifest: {
      id,
      title: id,
      enabled: true,
      protocol: "wasi-component",
      componentEntry: "service.wasm",
      providerIds:
        kind === "composition"
          ? ["nextclaw-portable-runtime-lab-provider"]
          : [],
      lifecycle:
        kind === "resident"
          ? { mode: "resident", eventIntervalMs: 250 }
          : kind === "provider"
            ? { mode: "provider" }
            : { mode: "action" },
      actions: Object.fromEntries(
        actionNames.map((name) => [
          name,
          {
            risk: "read",
            timeoutMs: name === "simulate_timeout" ? 1_200 : undefined,
          },
        ]),
      ),
    },
  };
}

async function createMountEchoRunner(directory: string): Promise<string> {
  const runnerPath = path.join(directory, "mount-echo-runner.mjs");
  await writeFile(
    runnerPath,
    `#!/usr/bin/env node
import readline from "node:readline";
readline.createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  const response = (result) => process.stdout.write(JSON.stringify({ kind: "response", requestId: request.requestId, protocolVersion: "0.2.0", ok: true, result }) + "\\n");
  if (request.operation === "start-job") {
    response({ jobId: request.jobId });
    process.stdout.write(JSON.stringify({ kind: "job-terminal", protocolVersion: "0.2.0", jobId: request.jobId, sequence: 1, status: "succeeded", result: request.app.fileMounts }) + "\\n");
    return;
  }
  response([]);
});
`,
  );
  await chmod(runnerPath, 0o755);
  return runnerPath;
}

async function createSecretEchoRunner(
  directory: string,
  firstSecret: string,
  secondSecret: string,
): Promise<string> {
  const runnerPath = path.join(directory, "secret-echo-runner.mjs");
  await writeFile(
    runnerPath,
    `#!/usr/bin/env node
import readline from "node:readline";
let stopCount = 0;
readline.createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  if (request.operation === "stop") stopCount += 1;
  const secret = request.app?.secretVariables?.["nextclaw_secret_6170692d746f6b656e"];
  const fingerprint = request.app?.secretFingerprints?.["api-token"] ?? "";
  const result = request.operation === "start-job" ? {
    accepted: secret === ${JSON.stringify(firstSecret)} || secret === ${JSON.stringify(secondSecret)},
    secretLeaked: JSON.stringify({ slots: Object.keys(request.app?.secretVariables ?? {}), fingerprints: request.app?.secretFingerprints ?? {} }).includes(secret ?? ""),
    stopCount,
    slots: Object.keys(request.app?.secretVariables ?? {}),
    fingerprintLength: fingerprint.length,
  } : { stopCount };
  const response = (value) => process.stdout.write(JSON.stringify({ kind: "response", requestId: request.requestId, protocolVersion: "0.2.0", ok: true, result: value }) + "\\n");
  if (request.operation === "start-job") {
    response({ jobId: request.jobId });
    process.stdout.write(JSON.stringify({ kind: "job-terminal", protocolVersion: "0.2.0", jobId: request.jobId, sequence: 1, status: "succeeded", result }) + "\\n");
    return;
  }
  response(result);
});
`,
  );
  await chmod(runnerPath, 0o755);
  return runnerPath;
}
