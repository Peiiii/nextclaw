import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ServiceAppManifest, ServiceAppRecord } from "@kernel/types/service-app.types.js";
import { PortableServiceAppRuntimeService } from "./portable-service-app-runtime.service.js";
import { ServiceAppResidentEventInboxService } from "./service-app-resident-event-inbox.service.js";

const REPOSITORY_ROOT = path.resolve(process.cwd(), "../..");
const RUNNER_PATH = path.join(
  REPOSITORY_ROOT,
  `packages/nextclaw/resources/native/${process.platform}-${process.arch}`,
  process.platform === "win32" ? "nextclaw-wasmtime-runner.exe" : "nextclaw-wasmtime-runner",
);
const COMPONENT_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "packages/nextclaw/resources/apps/nextclaw-portable-runtime-lab/service-components/nextclaw-portable-runtime-lab-resident",
);

let dataRoot: string;
let runtime: PortableServiceAppRuntimeService;

beforeEach(async () => {
  dataRoot = await mkdtemp(path.join(os.tmpdir(), "nextclaw-resident-backpressure-"));
  runtime = new PortableServiceAppRuntimeService({ runnerPath: RUNNER_PATH });
});

afterEach(async () => {
  await runtime.dispose();
  await rm(dataRoot, { recursive: true, force: true });
});

describe("PortableServiceAppRuntimeService resident backpressure", () => {
  it("stops scheduled ingress while the timer stream is blocked by a dead letter", async () => {
    await runtime.dispose();
    const inbox = new ServiceAppResidentEventInboxService();
    runtime = new PortableServiceAppRuntimeService({ residentInbox: inbox, runnerPath: RUNNER_PATH });
    const resident = createResident();
    const target = {
      appId: resident.app.id,
      instanceId: resident.app.id,
      stateDirectory: resident.app.dataDirectory!,
    };
    await inbox.enqueue(target, {
      eventId: "blocked-timer",
      streamKey: "timer",
      payload: { eventId: "blocked-timer", kind: "timer", triggeredAt: "test" },
    });
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await expect(inbox.leaseNext(target, { now: new Date(Date.now() + 120_000) }))
        .resolves.toMatchObject({ eventId: "blocked-timer", attempt });
      await inbox.retry(target, "blocked-timer", { kind: "retry", delayMs: 0 });
    }

    await runtime.start(resident);
    await new Promise((resolve) => setTimeout(resolve, 650));

    await expect(inbox.list(target)).resolves.toMatchObject({
      entries: [{ eventId: "blocked-timer", status: "dead-letter" }],
    });
    expect(runtime.getStatus(resident.app.id).status).toBe("running");
  });
});

function createResident(): { app: ServiceAppRecord; manifest: ServiceAppManifest } {
  const id = "nextclaw-portable-runtime-lab-resident";
  return {
    app: {
      id,
      title: id,
      dirPath: COMPONENT_DIRECTORY,
      manifestPath: path.join(COMPONENT_DIRECTORY, "service-app.json"),
      cwd: COMPONENT_DIRECTORY,
      enabled: true,
      protocol: "wasi-component",
      status: "idle",
      sourceKind: "package",
      dataDirectory: dataRoot,
      componentPath: path.join(COMPONENT_DIRECTORY, "service.wasm"),
      runtimeProfile: "wasi",
      isolation: "host-mediated",
      permissions: { storage: true },
    },
    manifest: {
      id,
      title: id,
      enabled: true,
      protocol: "wasi-component",
      componentEntry: "service.wasm",
      lifecycle: { mode: "resident", eventIntervalMs: 250 },
      actions: { resident_status: { risk: "read" } },
    },
  };
}
