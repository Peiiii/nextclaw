import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PortableServiceAppRuntimeService } from "./portable-service-app-runtime.service.js";
import type { ServiceAppManifest, ServiceAppRecord } from "@kernel/types/service-app.types.js";

const REPOSITORY_ROOT = path.resolve(process.cwd(), "../..");
const RUNNER_PATH = path.join(
  REPOSITORY_ROOT,
  `packages/nextclaw/resources/native/${process.platform}-${process.arch}`,
  process.platform === "win32" ? "nextclaw-wasmtime-runner.exe" : "nextclaw-wasmtime-runner",
);
const APP_ROOT = path.join(
  REPOSITORY_ROOT,
  "packages/nextclaw/resources/apps/nextclaw-portable-runtime-lab/service-components",
);

let dataRoot: string;
let runtime: PortableServiceAppRuntimeService;
let previousRunnerPath: string | undefined;

beforeEach(async () => {
  dataRoot = await mkdtemp(path.join(os.tmpdir(), "nextclaw-portable-runtime-"));
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
  it("runs two Rust components in one runner with mediated storage and policy denial", async () => {
    const state = createFixture("state");
    const capabilities = createFixture("capabilities");

    await expect(runtime.listActions(state)).resolves.toHaveLength(8);
    await expect(runtime.listActions(capabilities)).resolves.toHaveLength(5);

    await expect(runtime.invokeAction({
      ...state,
      actionName: "counter_increment",
      input: { step: 3 },
    })).resolves.toMatchObject({ counter: 3, persistedBy: "host.kv" });

    const stateInfo = await runtime.invokeAction({
      ...state,
      actionName: "runtime_info",
      input: {},
    }) as { runnerPid: number };
    const capabilityInfo = await runtime.invokeAction({
      ...capabilities,
      actionName: "runtime_info",
      input: {},
    }) as { runnerPid: number; loadedComponents: number };
    expect(capabilityInfo).toMatchObject({
      runnerPid: stateInfo.runnerPid,
      loadedComponents: 2,
    });

    await expect(runtime.invokeAction({
      ...capabilities,
      actionName: "network_denied",
      input: {},
    })).resolves.toMatchObject({
      denied: true,
      reason: expect.stringContaining("NETWORK_DENIED"),
    });

    const deniedState = createFixture("state");
    deniedState.app.permissions = {};
    await expect(runtime.invokeAction({
      ...deniedState,
      actionName: "counter_read",
      input: {},
    })).rejects.toThrow("CAPABILITY_DENIED: storage permission is required");
  });

  it("kills an over-budget runner, rebuilds it, and keeps host storage", async () => {
    const state = createFixture("state");
    const capabilities = createFixture("capabilities");
    await runtime.invokeAction({
      ...state,
      actionName: "counter_increment",
      input: { step: 1 },
    });

    await expect(runtime.invokeAction({
      ...capabilities,
      actionName: "simulate_timeout",
      input: {},
    })).rejects.toMatchObject({ code: "PORTABLE_RUNTIME_TIMEOUT" });

    await expect(runtime.invokeAction({
      ...state,
      actionName: "counter_read",
      input: {},
    })).resolves.toMatchObject({ counter: 1, persistedBy: "host.kv" });
  });

  it("retains one resident instance, delivers host events, and resumes durable state", async () => {
    const resident = createFixture("resident");
    await runtime.start(resident);
    await expect(runtime.listActions(resident)).resolves.toHaveLength(4);

    const initial = await runtime.invokeAction({
      ...resident,
      actionName: "resident_status",
      input: {},
    }) as { eventCount: number; instanceEpoch: number };

    await expect.poll(async () => {
      const status = await runtime.invokeAction({
        ...resident,
        actionName: "resident_status",
        input: {},
      }) as { eventCount: number };
      return status.eventCount;
    }, { interval: 100, timeout: 2_000 }).toBeGreaterThan(initial.eventCount);

    const beforeRestart = await runtime.invokeAction({
      ...resident,
      actionName: "resident_status",
      input: {},
    }) as { eventCount: number; inMemoryEventCount: number; instanceEpoch: number };
    expect(beforeRestart.inMemoryEventCount).toBeGreaterThan(0);

    await runtime.stop(resident.app.id);
    await runtime.start(resident);
    const afterRestart = await runtime.invokeAction({
      ...resident,
      actionName: "resident_status",
      input: {},
    }) as { eventCount: number; inMemoryEventCount: number; instanceEpoch: number };
    expect(afterRestart).toMatchObject({
      eventCount: beforeRestart.eventCount,
      inMemoryEventCount: 0,
      instanceEpoch: beforeRestart.instanceEpoch + 1,
    });
  });
});

describe("PortableServiceAppRuntimeService composition and recovery", () => {
  it("registers a provider and mediates declared cross-component composition", async () => {
    const provider = createFixture("provider");
    const composition = createFixture("composition");
    await runtime.start(provider);

    await expect(runtime.invokeAction({
      ...composition,
      actionName: "compose_contact",
      input: {
        name: "  Ada   Lovelace  ",
        email: " ADA@EXAMPLE.COM ",
        tags: ["AI", "ai", "Math"],
      },
    })).resolves.toMatchObject({
      displayLabel: "Ada Lovelace <ada@example.com>",
      mediatedBy: "host.component-call",
      provider: {
        normalizedTags: ["ai", "math"],
        providerCallCount: 1,
      },
    });

    await expect(runtime.invokeAction({
      ...composition,
      actionName: "provider_denied",
      input: {},
    })).resolves.toMatchObject({
      denied: true,
      reason: expect.stringContaining("PROVIDER_DENIED"),
    });
  });

  it("restores Provider and Resident roles after an unrelated Action timeout", async () => {
    const provider = createFixture("provider");
    const resident = createFixture("resident");
    const capabilities = createFixture("capabilities");
    const composition = createFixture("composition");
    await runtime.start(provider);
    await runtime.start(resident);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const beforeTimeout = await runtime.invokeAction({
      ...resident,
      actionName: "resident_status",
      input: {},
    }) as { eventCount: number; instanceEpoch: number };

    await expect(runtime.invokeAction({
      ...capabilities,
      actionName: "simulate_timeout",
      input: {},
    })).rejects.toThrow("execution budget");

    await expect(runtime.invokeAction({
      ...composition,
      actionName: "compose_contact",
      input: { name: "Grace Hopper", email: "GRACE@EXAMPLE.COM", tags: ["AI"] },
    })).resolves.toMatchObject({
      displayLabel: "Grace Hopper <grace@example.com>",
      mediatedBy: "host.component-call",
    });
    await expect(runtime.invokeAction({
      ...resident,
      actionName: "resident_status",
      input: {},
    })).resolves.toMatchObject({
      eventCount: beforeTimeout.eventCount,
      instanceEpoch: beforeTimeout.instanceEpoch + 1,
    });
  });

  it("restores Provider and Resident roles after the shared runner exits while idle", async () => {
    const provider = createFixture("provider");
    const resident = createFixture("resident");
    const composition = createFixture("composition");
    await runtime.start(provider);
    await runtime.start(resident);
    const beforeExit = await runtime.invokeAction({
      ...resident,
      actionName: "resident_status",
      input: {},
    }) as { eventCount: number; instanceEpoch: number };
    const runtimeInfo = await runtime.invokeAction({
      ...resident,
      actionName: "runtime_info",
      input: {},
    }) as { runnerPid: number };

    process.kill(runtimeInfo.runnerPid, "SIGTERM");

    await expect.poll(async () => {
      const status = await runtime.invokeAction({
        ...resident,
        actionName: "resident_status",
        input: {},
      }) as { instanceEpoch: number };
      return status.instanceEpoch;
    }, { interval: 100, timeout: 3_000 }).toBe(beforeExit.instanceEpoch + 1);
    await expect(runtime.invokeAction({
      ...composition,
      actionName: "compose_contact",
      input: { name: "Katherine Johnson", email: "KJ@EXAMPLE.COM", tags: ["NASA"] },
    })).resolves.toMatchObject({
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
  const actionNames = kind === "state"
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
    ? ["resident_status", "resident_emit_event", "resident_reset", "runtime_info"]
    : kind === "provider"
    ? ["contact_normalize", "provider_status", "runtime_info"]
    : kind === "composition"
    ? ["compose_contact", "provider_denied", "runtime_info"]
    : ["network_allowed", "network_denied", "structured_failure", "simulate_timeout", "runtime_info"];
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
      providerIds: kind === "composition"
        ? ["nextclaw-portable-runtime-lab-provider"]
        : [],
    },
    manifest: {
      id,
      title: id,
      enabled: true,
      protocol: "wasi-component",
      componentEntry: "service.wasm",
      providerIds: kind === "composition"
        ? ["nextclaw-portable-runtime-lab-provider"]
        : [],
      lifecycle: kind === "resident"
        ? { mode: "resident", eventIntervalMs: 250 }
        : kind === "provider"
        ? { mode: "provider" }
        : { mode: "action" },
      actions: Object.fromEntries(actionNames.map((name) => [name, {
        risk: "read",
        timeoutMs: name === "simulate_timeout" ? 1_200 : undefined,
      }])),
    },
  };
}
