import { describe, expect, it, vi } from "vitest";
import path from "node:path";
import { AppPackageLiveService } from "./app-package-live.service.js";

describe("AppPackageLiveService", () => {
  it("uses the host App Package operation API as the only lifecycle owner", async () => {
    const request = vi.fn().mockResolvedValue({ id: "operation-1", status: "queued" });
    const service = new AppPackageLiveService({ createApiClient: () => ({ request }) });

    await service.install(" ./local-app ");
    await service.update("example.notes", { version: "1.2.0" });
    await service.rollback("example.notes", "1.1.0");
    await service.uninstall("example.notes", true);
    await service.enable("example.notes");
    await service.disable("example.notes");

    expect(request).toHaveBeenNthCalledWith(1, {
      path: "/api/app-package-operations/install",
      method: "POST",
      body: { source: path.resolve("./local-app"), registryUrl: undefined },
    });
    expect(request).toHaveBeenNthCalledWith(2, {
      path: "/api/app-package-operations/example.notes/update",
      method: "POST",
      body: { version: "1.2.0" },
    });
    expect(request).toHaveBeenNthCalledWith(3, {
      path: "/api/app-package-operations/example.notes/rollback",
      method: "POST",
      body: { version: "1.1.0" },
    });
    expect(request).toHaveBeenNthCalledWith(4, {
      path: "/api/app-package-operations/example.notes/uninstall",
      method: "POST",
      body: { purgeData: true },
    });
    expect(request).toHaveBeenNthCalledWith(5, {
      path: "/api/app-packages/example.notes/enable",
      method: "POST",
    });
    expect(request).toHaveBeenNthCalledWith(6, {
      path: "/api/app-packages/example.notes/disable",
      method: "POST",
    });
  });

  it("keeps registry selectors unchanged while resolving local bundles at the CLI boundary", async () => {
    const request = vi.fn().mockResolvedValue({ id: "operation-1", status: "queued" });
    const service = new AppPackageLiveService({ createApiClient: () => ({ request }) });

    await service.install("example.notes@1.2.0");
    await service.install("dist/example.notes.napp");

    expect(request).toHaveBeenNthCalledWith(1, expect.objectContaining({
      body: { source: "example.notes@1.2.0", registryUrl: undefined },
    }));
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({
      body: { source: path.resolve("dist/example.notes.napp"), registryUrl: undefined },
    }));
  });

  it("calls installed Apps and reads host-owned verification records", async () => {
    const request = vi.fn().mockResolvedValue({ actionId: "notes.read", result: { ok: true } });
    const service = new AppPackageLiveService({ createApiClient: () => ({ request }) });

    await service.invoke("example.notes", "read", { page: 1 });
    await service.listVerificationRecords({ acceptanceId: "PRT-ENTRY-001", appId: "example.notes", limit: 2 });

    expect(request).toHaveBeenNthCalledWith(1, {
      path: "/api/service-apps/example.notes/actions/read/invoke",
      method: "POST",
      body: { input: { page: 1 } },
    });
    expect(request).toHaveBeenNthCalledWith(2, {
      path: "/api/runtime-verification-records?acceptanceId=PRT-ENTRY-001&appId=example.notes&limit=2",
    });
  });

  it("reads the host-owned acceptance contract and status instead of reconstructing PRT ids", async () => {
    const request = vi.fn().mockResolvedValue({ entries: [] });
    const service = new AppPackageLiveService({ createApiClient: () => ({ request }) });

    await service.portableRuntimeAcceptanceContract("en");
    await service.portableRuntimeAcceptanceStatus({ appId: "example.acceptance", locale: "en" });
    await service.exportPortableRuntimeAcceptance({ appId: "example.acceptance" });

    expect(request).toHaveBeenNthCalledWith(1, { path: "/api/portable-runtime/acceptance/contract?locale=en" });
    expect(request).toHaveBeenNthCalledWith(2, { path: "/api/portable-runtime/acceptance/status?appId=example.acceptance&locale=en" });
    expect(request).toHaveBeenNthCalledWith(3, { path: "/api/portable-runtime/acceptance/export?appId=example.acceptance" });
  });

  it("uses the host-owned Job journal APIs without inventing a second runtime path", async () => {
    const request = vi.fn().mockResolvedValue({ entries: [] });
    const service = new AppPackageLiveService({ createApiClient: () => ({ request }) });

    await service.listJobs("example.notes");
    await service.inspectJob("example.notes", "job-1");
    await service.watchJob("example.notes", "job-1", 4);
    await service.cancelJob("example.notes", "job-1");

    expect(request).toHaveBeenNthCalledWith(1, {
      path: "/api/service-apps/example.notes/jobs",
    });
    expect(request).toHaveBeenNthCalledWith(2, {
      path: "/api/service-apps/example.notes/jobs/job-1",
    });
    expect(request).toHaveBeenNthCalledWith(3, {
      path: "/api/service-apps/example.notes/jobs/job-1/watch?afterSequence=4",
    });
    expect(request).toHaveBeenNthCalledWith(4, {
      path: "/api/service-apps/example.notes/jobs/job-1/cancel", method: "POST",
    });
  });

  it("uses the same host-owned Resident inbox for inspection and dead-letter replay", async () => {
    const request = vi.fn().mockResolvedValue({ entries: [] });
    const service = new AppPackageLiveService({ createApiClient: () => ({ request }) });
    await service.listResidentInbox("example.resident", true);
    await service.replayResidentDeadLetter("example.resident", "event-1");
    expect(request).toHaveBeenNthCalledWith(1, {
      path: "/api/service-apps/example.resident/resident-inbox?deadLetters=true",
    });
    expect(request).toHaveBeenNthCalledWith(2, {
      path: "/api/service-apps/example.resident/resident-inbox/event-1/replay", method: "POST",
    });
  });

  it("uses the host Secret binding owner without carrying values through the CLI", async () => {
    const request = vi.fn().mockResolvedValue({ readiness: { status: "ready" }, slots: [] });
    const service = new AppPackageLiveService({ createApiClient: () => ({ request }) });

    await service.inspectSecrets("example.notes");
    await service.bindSecret("example.notes", {
      slotId: "issue-api-token", source: "env", id: "ISSUE_API_TOKEN",
    });
    await service.verifySecrets("example.notes");
    await service.unbindSecret("example.notes", "issue-api-token");

    expect(request).toHaveBeenNthCalledWith(1, { path: "/api/app-packages/example.notes/secrets" });
    expect(request).toHaveBeenNthCalledWith(2, {
      path: "/api/app-packages/example.notes/secrets/bind",
      method: "POST",
      body: { slotId: "issue-api-token", source: "env", id: "ISSUE_API_TOKEN" },
    });
    expect(request).toHaveBeenNthCalledWith(3, {
      path: "/api/app-packages/example.notes/secrets/verify", method: "POST",
    });
    expect(request).toHaveBeenNthCalledWith(4, {
      path: "/api/app-packages/example.notes/secrets/unbind", method: "POST",
      body: { slotId: "issue-api-token" },
    });
  });

  it("fails clearly when the managed host is unavailable", async () => {
    const service = new AppPackageLiveService({ createApiClient: () => null });
    await expect(service.list()).rejects.toThrow("UI runtime is not running");
  });
});
