import { afterEach, describe, expect, it, vi } from "vitest";
import { AppPackageCommandController } from "./app-package-command.controller.js";

afterEach(() => vi.restoreAllMocks());

describe("AppPackageCommandController", () => {
  it("renders App lifecycle operations through the unified CLI", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const liveService = {
      install: vi.fn().mockResolvedValue({
        id: "operation-1", action: "install", status: "queued", source: "example.notes",
      }),
      enable: vi.fn().mockResolvedValue({
        id: "example.notes", name: "Notes", activeVersion: "1.0.0", enabled: true,
        builtIn: false, installedVersions: ["1.0.0"],
        readiness: { status: "ready", requirements: [] },
      }),
    };
    const controller = new AppPackageCommandController(liveService as never, {} as never);

    await controller.install("example.notes", {});
    await controller.enable("example.notes", { json: true });

    expect(write).toHaveBeenNthCalledWith(1, expect.stringContaining("App operation operation-1"));
    expect(write).toHaveBeenNthCalledWith(2, expect.stringContaining('"enabled": true'));
    expect(liveService.install).toHaveBeenCalledWith("example.notes", undefined);
  });

  it("derives the Marketplace installation text from the shared contract", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const marketplaceService = {
      info: vi.fn().mockResolvedValue({
        appId: "example.notes", name: "Notes", summary: "Notes", latestVersion: "1.0.0",
        tags: [], author: "Example", install: { spec: "example.notes", registry: "https://example.test" },
      }),
    };
    const controller = new AppPackageCommandController({} as never, marketplaceService as never);

    await controller.marketplaceInfo("example.notes", {});

    expect(write).toHaveBeenCalledWith(expect.stringContaining("nextclaw app install example.notes"));
  });

  it("requires an exact confirmation before purging App data", async () => {
    const liveService = { uninstall: vi.fn() };
    const controller = new AppPackageCommandController(liveService as never, {} as never);

    await expect(controller.uninstall("example.notes", { purgeData: true }))
      .rejects.toThrow("--confirm");
    expect(liveService.uninstall).not.toHaveBeenCalled();
  });

  it("keeps installed invocation distinct from source development calls", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const liveService = {
      invoke: vi.fn().mockResolvedValue({
        actionId: "notes.read", result: { ok: true },
        invocation: { callId: "call-1", traceId: "trace-1", dataVersion: "instance-v1:1", verificationRunId: "run-1" },
      }),
    };
    const controller = new AppPackageCommandController(liveService as never, {} as never);

    await controller.invoke("example.notes", "read", { input: '{"page":1}' });

    expect(liveService.invoke).toHaveBeenCalledWith("example.notes", "read", { page: 1 });
    expect(write).toHaveBeenCalledWith(expect.stringContaining("trace: trace-1"));
  });

  it("renders acceptance status through the host projection and exports JSON", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const liveService = {
      portableRuntimeAcceptanceContract: vi.fn(async () => ({
        contractFingerprint: "sha256:contract", definitions: [{ id: "PRT-EXEC-001", category: "execution", presentation: { title: "执行" } }],
      })),
      portableRuntimeAcceptanceStatus: vi.fn(async () => ({
        appId: "nextclaw.github-issue-watcher", identity: { available: false, reason: "runner unavailable" },
        contract: { contractFingerprint: "sha256:contract" }, entries: [{ id: "PRT-EXEC-001", result: { status: "missing" }, presentation: { title: "执行" } }],
      })),
      exportPortableRuntimeAcceptance: vi.fn(async () => ({ schemaVersion: 1, entries: [] })),
    };
    const controller = new AppPackageCommandController(liveService as never, {} as never);

    await controller.acceptanceContract({ locale: "zh-CN" });
    await controller.acceptanceStatus({ app: "example.acceptance", locale: "en" });
    await controller.acceptanceExport({ app: "example.acceptance" });

    expect(liveService.portableRuntimeAcceptanceStatus).toHaveBeenCalledWith({ appId: "example.acceptance", locale: "en" });
    expect(liveService.exportPortableRuntimeAcceptance).toHaveBeenCalledWith({ appId: "example.acceptance", locale: undefined });
    expect(write).toHaveBeenLastCalledWith(expect.stringContaining('"schemaVersion": 1'));
  });

  it("renders Job inspection and keeps cancellation pending until the runtime confirms it", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const liveService = {
      listJobs: vi.fn(async () => ({ entries: [{
        id: "job-1", status: "running", componentId: "notes", actionName: "sync", callId: "call-1", traceId: "trace-1",
      }] })),
      watchJob: vi.fn(async () => ({
        job: { id: "job-1", status: "running", componentId: "notes", actionName: "sync", callId: "call-1", traceId: "trace-1" },
        events: [{ sequence: 2, type: "progress" }], cursor: 2,
      })),
      cancelJob: vi.fn(async () => ({
        id: "job-1", status: "cancel-requested", componentId: "notes", actionName: "sync", callId: "call-1", traceId: "trace-1",
      })),
    };
    const controller = new AppPackageCommandController(liveService as never, {} as never);

    await controller.listJobs("example.notes", {});
    await controller.watchJob("example.notes", "job-1", { after: "1" });
    await controller.cancelJob("example.notes", "job-1", {});

    expect(liveService.watchJob).toHaveBeenCalledWith("example.notes", "job-1", 1);
    expect(liveService.cancelJob).toHaveBeenCalledWith("example.notes", "job-1");
    expect(write).toHaveBeenLastCalledWith(expect.stringContaining("cancel-requested"));
  });
});
