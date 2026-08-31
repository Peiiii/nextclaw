import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import {
  ServiceAppError,
  type PanelAppBridgeSession,
  type ServiceActionCaller,
} from "@nextclaw/kernel";
import { EventBus } from "@nextclaw/shared";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";
import type { UiKernelHost } from "@nextclaw-server/app/types/router-options.types.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-service-apps-route-test-"));
  tempDirs.push(dir);
  const configPath = join(dir, "config.json");
  saveConfig(ConfigSchema.parse({}), configPath);
  return configPath;
}

function createTestApp(params: Omit<Partial<UiKernelHost>, "panelAppManager" | "serviceAppManager"> & {
  panelAppManager?: Record<string, unknown>;
  serviceAppManager?: Record<string, unknown>;
}) {
  return createUiRouter({
    configPath: createTempConfigPath(),
    appEventBus: new EventBus(),
    kernel: createRouterTestKernel({
    ...params,
    panelAppManager: params.panelAppManager as unknown as UiKernelHost["panelAppManager"],
    serviceAppManager: params.serviceAppManager as unknown as UiKernelHost["serviceAppManager"],
    }),
  });
}

function createBridgeSession(): PanelAppBridgeSession {
  const caller: ServiceActionCaller = {
    surface: "panel-app",
    appId: "todo-panel",
  };
  return {
    id: "session-1",
    token: "bridge-token",
    appId: "todo-panel",
    caller,
    declaredCapabilities: [],
    declaredActions: ["notes.read"],
    clientDeclared: false,
    createdAt: "2026-05-27T00:00:00.000Z",
    expiresAt: "2026-05-27T01:00:00.000Z",
  };
}

async function assertStructuredRuntimeFailureResponse(): Promise<void> {
  const bridgeSession = createBridgeSession();
  const app = createTestApp({
    panelAppManager: {
      resolvePanelAppBridgeSession: () => bridgeSession,
    },
    serviceAppManager: {
      invokeServiceAction: async () => {
        throw new ServiceAppError(
          "SERVICE_APP_RUNTIME_FAILED",
          "Service App notes failed to start.",
        );
      },
    },
  });

  const response = await app.request("http://localhost/api/service-actions/notes.read/invoke", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-nextclaw-panel-bridge-session": "bridge-token",
    },
    body: JSON.stringify({ input: {} }),
  });
  const payload = await response.json() as {
    ok: false;
    error: { code: string; message: string };
  };

  expect(response.status).toBe(502);
  expect(payload).toEqual({
    ok: false,
    error: {
      code: "SERVICE_APP_RUNTIME_FAILED",
      message: "Service App notes failed to start.",
    },
  });
}

  it("invokes an installed App action without a Panel bridge and exposes recorded evidence", async () => {
  const invokeInstalledServiceAction = vi.fn(async () => ({
    actionId: "notes.read",
    result: { ok: true },
    invocation: { callId: "call-1", traceId: "trace-1", dataVersion: "instance-v1:1", verificationRunId: "run-1" },
  }));
  const listVerificationRecords = vi.fn(async () => ({ entries: [] }));
  const app = createTestApp({
    serviceAppManager: { invokeInstalledServiceAction, listVerificationRecords },
  });

  const invoke = await app.request("http://localhost/api/service-apps/example.notes/actions/read/invoke", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: { page: 1 } }),
  });
  expect(invoke.status).toBe(200);
  await expect(invoke.json()).resolves.toMatchObject({ ok: true, data: { invocation: { traceId: "trace-1" } } });
  expect(invokeInstalledServiceAction).toHaveBeenCalledWith("example.notes", "read", { page: 1 });

  const records = await app.request("http://localhost/api/runtime-verification-records?acceptanceId=PRT-ENTRY-001&appId=example.notes&limit=1");
  expect(records.status).toBe(200);
  expect(listVerificationRecords).toHaveBeenCalledWith({ acceptanceId: "PRT-ENTRY-001", appId: "example.notes", limit: 1 });
});

it("projects the portable runtime acceptance registry through contract, status, and export endpoints", async () => {
  const contract = vi.fn(() => ({ contractFingerprint: "sha256:contract", locale: "en", definitions: [{ id: "PRT-EXEC-001" }] }));
  const status = vi.fn(async () => ({ schemaVersion: 1, appId: "nextclaw.github-issue-watcher", entries: [{ id: "PRT-EXEC-001", result: { status: "missing" } }] }));
  const exportEvidence = vi.fn(async () => ({ schemaVersion: 1, appId: "nextclaw.github-issue-watcher", entries: [{ id: "PRT-EXEC-001" }] }));
  const app = createTestApp({
    serviceAppManager: {},
    portableRuntimeAcceptance: { contract, status, export: exportEvidence } as never,
  } as never);

  await expect((await app.request("http://localhost/api/portable-runtime/acceptance/contract?locale=en")).json())
    .resolves.toMatchObject({ ok: true, data: { contractFingerprint: "sha256:contract", locale: "en" } });
  await expect((await app.request("http://localhost/api/portable-runtime/acceptance/status?appId=example.acceptance&locale=en")).json())
    .resolves.toMatchObject({ ok: true, data: { appId: "nextclaw.github-issue-watcher" } });
  await expect((await app.request("http://localhost/api/portable-runtime/acceptance/export?appId=example.acceptance")).json())
    .resolves.toMatchObject({ ok: true, data: { schemaVersion: 1 } });

  expect(contract).toHaveBeenCalledWith("en");
  expect(status).toHaveBeenCalledWith({ appId: "example.acceptance", locale: "en" });
  expect(exportEvidence).toHaveBeenCalledWith({ appId: "example.acceptance", locale: "zh-CN" });
});

it("exposes durable Job inspection, cursor replay, and cancellation through the Service App API", async () => {
  const listServiceAppJobs = vi.fn(async () => ({ entries: [{ id: "job-1", status: "running" }] }));
  const getServiceAppJob = vi.fn(async () => ({ id: "job-1", status: "running" }));
  const watchServiceAppJob = vi.fn(async () => ({
    job: { id: "job-1", status: "running" },
    events: [{ sequence: 2, timestamp: "2026-08-30T00:00:00.000Z", type: "progress" }],
    cursor: 2,
  }));
  const cancelServiceAppJob = vi.fn(async () => ({ id: "job-1", status: "cancel-requested" }));
  const app = createTestApp({
    panelAppManager: {},
    serviceAppManager: { listServiceAppJobs, getServiceAppJob, watchServiceAppJob, cancelServiceAppJob },
  });

  await expect((await app.request("http://localhost/api/service-apps/example.notes/jobs")).json())
    .resolves.toMatchObject({ ok: true, data: { entries: [{ id: "job-1" }] } });
  await expect((await app.request("http://localhost/api/service-apps/example.notes/jobs/job-1")).json())
    .resolves.toMatchObject({ ok: true, data: { status: "running" } });
  await expect((await app.request("http://localhost/api/service-apps/example.notes/jobs/job-1/watch?afterSequence=1")).json())
    .resolves.toMatchObject({ ok: true, data: { cursor: 2 } });
  await expect((await app.request("http://localhost/api/service-apps/example.notes/jobs/job-1/cancel", { method: "POST" })).json())
    .resolves.toMatchObject({ ok: true, data: { status: "cancel-requested" } });

  expect(watchServiceAppJob).toHaveBeenCalledWith("example.notes", "job-1", 1);
  expect(cancelServiceAppJob).toHaveBeenCalledWith("example.notes", "job-1");
});

it("rejects malformed Job replay cursors before reaching the manager", async () => {
  const watchServiceAppJob = vi.fn();
  const app = createTestApp({ panelAppManager: {}, serviceAppManager: { watchServiceAppJob } });

  const response = await app.request("http://localhost/api/service-apps/example.notes/jobs/job-1/watch?afterSequence=-1");
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    ok: false, error: { code: "INVALID_JOB_CURSOR" },
  });
  expect(watchServiceAppJob).not.toHaveBeenCalled();
});

it("exposes durable Resident inbox inspection and dead-letter replay through the Service App API", async () => {
  const listResidentInbox = vi.fn(async () => ({
    entries: [{ eventId: "event-1", status: "dead-letter", streamKey: "timer", sequence: 1 }],
    cursors: {}, frozen: false,
  }));
  const replayResidentDeadLetter = vi.fn(async () => ({ eventId: "event-1", status: "pending" }));
  const app = createTestApp({
    panelAppManager: {},
    serviceAppManager: { listResidentInbox, replayResidentDeadLetter },
  });
  await expect((await app.request("http://localhost/api/service-apps/example.resident/resident-inbox?deadLetters=true")).json())
    .resolves.toMatchObject({ ok: true, data: { entries: [{ eventId: "event-1", status: "dead-letter" }] } });
  await expect((await app.request("http://localhost/api/service-apps/example.resident/resident-inbox/event-1/replay", { method: "POST" })).json())
    .resolves.toMatchObject({ ok: true, data: { eventId: "event-1", status: "pending" } });
  expect(listResidentInbox).toHaveBeenCalledWith("example.resident", { deadLettersOnly: true });
  expect(replayResidentDeadLetter).toHaveBeenCalledWith("example.resident", "event-1");
});

async function assertStructuredForeignRuntimeFailureResponse(): Promise<void> {
  const bridgeSession = createBridgeSession();
  const app = createTestApp({
    panelAppManager: { resolvePanelAppBridgeSession: () => bridgeSession },
    serviceAppManager: {
      invokeServiceAction: async () => {
        throw Object.assign(new Error("Service App notes failed to start."), {
          name: "ServiceAppError",
          code: "SERVICE_APP_RUNTIME_FAILED",
        });
      },
    },
  });
  const response = await app.request("http://localhost/api/service-actions/notes.read/invoke", {
    method: "POST",
    headers: { "content-type": "application/json", "x-nextclaw-panel-bridge-session": "bridge-token" },
    body: JSON.stringify({ input: {} }),
  });
  expect(response.status).toBe(502);
  await expect(response.json()).resolves.toMatchObject({
    ok: false,
    error: { code: "SERVICE_APP_RUNTIME_FAILED", message: "Service App notes failed to start." },
  });
}

async function assertStructuredWasiFailureResponse(): Promise<void> {
  const bridgeSession = createBridgeSession();
  const app = createTestApp({
    panelAppManager: { resolvePanelAppBridgeSession: () => bridgeSession },
    serviceAppManager: {
      invokeServiceAction: async () => {
        throw new ServiceAppError(
          "WASI_CAPABILITY_DENIED",
          "Storage access was denied.",
          { logs: ["host.kv: namespace is not allowed"] },
        );
      },
    },
  });
  const response = await app.request("http://localhost/api/service-actions/notes.read/invoke", {
    method: "POST",
    headers: { "content-type": "application/json", "x-nextclaw-panel-bridge-session": "bridge-token" },
    body: JSON.stringify({ input: {} }),
  });
  expect(response.status).toBe(403);
  await expect(response.json()).resolves.toEqual({
    ok: false,
    error: {
      code: "WASI_CAPABILITY_DENIED",
      message: "Storage access was denied.",
      details: { logs: ["host.kv: namespace is not allowed"] },
    },
  });
}

async function assertStructuredUnexpectedFailureResponse(): Promise<void> {
  const bridgeSession = createBridgeSession();
  const app = createTestApp({
    panelAppManager: {
      resolvePanelAppBridgeSession: () => bridgeSession,
    },
    serviceAppManager: {
      invokeServiceAction: async () => {
        throw new Error("unexpected runtime transport error");
      },
    },
  });

  const response = await app.request("http://localhost/api/service-actions/notes.read/invoke", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-nextclaw-panel-bridge-session": "bridge-token",
    },
    body: JSON.stringify({ input: {} }),
  });
  const payload = await response.json() as {
    ok: false;
    error: { code: string; message: string };
  };

  expect(response.status).toBe(500);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(payload).toEqual({
    ok: false,
    error: {
      code: "SERVICE_APP_REQUEST_FAILED",
      message: "The Service App request failed. Please retry.",
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});
describe("service apps routes", () => {
  it("requires a panel bridge session before invoking service actions", async () => {
    const app = createTestApp({
      panelAppManager: {},
      serviceAppManager: {},
    });

    const response = await app.request("http://localhost/api/service-actions/notes.read/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: {} }),
    });
    const payload = await response.json() as { ok: false; error: { code: string } };

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("PANEL_APP_BRIDGE_SESSION_REQUIRED");
  });

  it("passes bridge caller and declared actions into the service app manager", async () => {
    const bridgeSession = createBridgeSession();
    const invokeServiceAction = vi.fn(async () => ({
      actionId: "notes.read",
      result: { text: "hello" },
    }));
    const app = createTestApp({
      panelAppManager: {
        resolvePanelAppBridgeSession: () => bridgeSession,
      },
      serviceAppManager: {
        invokeServiceAction,
      },
    });

    const response = await app.request("http://localhost/api/service-actions/notes.read/invoke", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nextclaw-panel-bridge-session": "bridge-token",
      },
      body: JSON.stringify({ input: { path: "memory.md" } }),
    });
    const payload = await response.json() as {
      ok: true;
      data: { result: { text: string } };
    };

    expect(response.status).toBe(200);
    expect(payload.data.result.text).toBe("hello");
    expect(invokeServiceAction).toHaveBeenCalledWith("notes.read", {
      caller: bridgeSession.caller,
      declaredActions: bridgeSession.declaredActions,
      input: { path: "memory.md" },
    });
  });

  it("returns structured JSON when a Service App runtime fails", async () => {
    await assertStructuredRuntimeFailureResponse();
  });

  it("keeps a Service App runtime error structured across package copies", async () => {
    await assertStructuredForeignRuntimeFailureResponse();
  });

  it("preserves stable WASI errors and runner diagnostics", async () => {
    await assertStructuredWasiFailureResponse();
  });

  it("returns structured JSON when a Service App request fails unexpectedly", async () => {
    await assertStructuredUnexpectedFailureResponse();
  });

  it("uses POST for explicit service action discovery", async () => {
    const discoverServiceAppActions = vi.fn(async () => [{
      id: "notes.read",
      appId: "notes",
      name: "read",
      risk: "read" as const,
      runtimeState: "matched" as const,
    }]);
    const app = createTestApp({
      panelAppManager: {},
      serviceAppManager: {
        discoverServiceAppActions,
      },
    });

    const response = await app.request(
      "http://localhost/api/service-apps/notes/actions/discover",
      { method: "POST" },
    );
    const payload = await response.json() as {
      ok: true;
      data: { actions: Array<{ id: string; runtimeState: string }> };
    };

    expect(response.status).toBe(200);
    expect(payload.data.actions[0]).toEqual(expect.objectContaining({
      id: "notes.read",
      runtimeState: "matched",
    }));
    expect(discoverServiceAppActions).toHaveBeenCalledWith("notes");
  });

  it("deletes service apps through the service app manager", async () => {
    const deleteServiceApp = vi.fn(async (id: string, purgeData = false) => ({
      deleted: true as const,
      id,
      dataRemoved: purgeData,
    }));
    const app = createTestApp({
      panelAppManager: {},
      serviceAppManager: {
        deleteServiceApp,
      },
    });

    const response = await app.request(
      "http://localhost/api/service-apps/notes",
      { method: "DELETE" },
    );
    const payload = await response.json() as {
      ok: true;
      data: { deleted: true; id: string; dataRemoved: boolean };
    };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual({ deleted: true, id: "notes", dataRemoved: false });
    expect(deleteServiceApp).toHaveBeenCalledWith("notes", false);
  });

  it("passes optional app id filtering into action list queries", async () => {
    const listServiceActions = vi.fn(async () => []);
    const app = createTestApp({
      panelAppManager: {},
      serviceAppManager: {
        listServiceActions,
      },
    });

    const response = await app.request("http://localhost/api/service-actions?appId=notes");

    expect(response.status).toBe(200);
    expect(listServiceActions).toHaveBeenCalledWith({ appId: "notes" });
  });
});

describe("service app bridge and grant routes", () => {
  it("creates panel bridge sessions through the thin panel app route", async () => {
    const bridgeSession = createBridgeSession();
    const createPanelAppBridgeSession = vi.fn(async () => bridgeSession);
    const app = createTestApp({
      panelAppManager: {
        createPanelAppBridgeSession,
      },
      serviceAppManager: {},
    });

    const response = await app.request("http://localhost/api/panel-app-bridge-sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ panelAppId: "todo-panel", tabId: "tab-1" }),
    });
    const payload = await response.json() as {
      ok: true;
      data: { appId: string; token: string };
    };

    expect(response.status).toBe(200);
    expect(payload.data.token).toBe("bridge-token");
    expect(payload.data.appId).toBe("todo-panel");
    expect(createPanelAppBridgeSession).toHaveBeenCalledWith({
      id: "todo-panel",
    });
  });

  it("lists and revokes service action grants for the status panel", async () => {
    const revokeServiceAction = vi.fn(async () => {});
    const app = createTestApp({
      panelAppManager: {},
      serviceAppManager: {
        listServiceActionGrants: async () => [{
          caller: { surface: "panel-app", appId: "todo-panel" },
          actionId: "notes.read",
          risk: "read",
          grantedAt: "2026-05-27T00:00:00.000Z",
        }],
        revokeServiceAction,
      },
    });

    const listResponse = await app.request("http://localhost/api/service-action-grants");
    const listPayload = await listResponse.json() as {
      ok: true;
      data: { grants: Array<{ actionId: string }> };
    };
    expect(listResponse.status).toBe(200);
    expect(listPayload.data.grants[0]?.actionId).toBe("notes.read");

    const revokeResponse = await app.request(
      "http://localhost/api/service-action-grants/notes.read?surface=panel-app&appId=todo-panel",
      { method: "DELETE" },
    );

    expect(revokeResponse.status).toBe(200);
    expect(revokeServiceAction).toHaveBeenCalledWith(
      { surface: "panel-app", appId: "todo-panel" },
      "notes.read",
    );
  });

  it("grants multiple service actions with the bridge caller and declarations", async () => {
    const bridgeSession = createBridgeSession();
    const grantServiceActions = vi.fn(async () => [
      {
        caller: bridgeSession.caller,
        actionId: "notes.read",
        risk: "read" as const,
        grantedAt: "2026-05-27T00:00:00.000Z",
      },
    ]);
    const app = createTestApp({
      panelAppManager: {
        resolvePanelAppBridgeSession: () => bridgeSession,
      },
      serviceAppManager: {
        grantServiceActions,
      },
    });

    const response = await app.request("http://localhost/api/service-action-grants", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nextclaw-panel-bridge-session": "bridge-token",
      },
      body: JSON.stringify({ actionIds: ["notes.read"] }),
    });
    const payload = await response.json() as {
      ok: true;
      data: { grants: Array<{ actionId: string }> };
    };

    expect(response.status).toBe(200);
    expect(payload.data.grants[0]?.actionId).toBe("notes.read");
    expect(grantServiceActions).toHaveBeenCalledWith(["notes.read"], {
      caller: bridgeSession.caller,
      declaredActions: bridgeSession.declaredActions,
    });
  });

  it("grants and revokes Service Actions for an Agent through the resource endpoint", async () => {
    const grantServiceActions = vi.fn(async () => [{
      caller: { surface: "agent" as const, agentId: "main" },
      actionId: "notes.read",
      risk: "read" as const,
      grantedAt: "2026-05-27T00:00:00.000Z",
    }]);
    const revokeServiceAction = vi.fn(async () => {});
    const app = createTestApp({
      panelAppManager: {},
      serviceAppManager: { grantServiceActions, revokeServiceAction },
    });

    const grantResponse = await app.request(
      "http://localhost/api/agents/main/service-action-grants",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actionIds: ["notes.read"] }),
      },
    );
    expect(grantResponse.status).toBe(200);
    expect(grantServiceActions).toHaveBeenCalledWith(
      ["notes.read"],
      { caller: { surface: "agent", agentId: "main" } },
    );

    const revokeResponse = await app.request(
      "http://localhost/api/service-action-grants/notes.read?surface=agent&callerId=main",
      { method: "DELETE" },
    );
    expect(revokeResponse.status).toBe(200);
    expect(revokeServiceAction).toHaveBeenCalledWith(
      { surface: "agent", agentId: "main" },
      "notes.read",
    );
  });

  it("invokes an Agent-granted Service Action through the same manager path", async () => {
    const invokeServiceAction = vi.fn(async () => ({
      actionId: "notes.read",
      result: { value: 4 },
      invocation: { callId: "agent-call", traceId: "agent-trace", dataVersion: "instance-v1", verificationRunId: "agent-record" },
    }));
    const app = createTestApp({
      panelAppManager: {},
      serviceAppManager: { invokeServiceAction },
    });
    const response = await app.request(
      "http://localhost/api/agents/main/service-actions/notes.read/invoke",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: { page: 4 } }),
      },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { invocation: { traceId: "agent-trace" }, result: { value: 4 } },
    });
    expect(invokeServiceAction).toHaveBeenCalledWith("notes.read", {
      caller: { surface: "agent", agentId: "main" },
      input: { page: 4 },
    });
  });
});
