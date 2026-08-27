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
});
