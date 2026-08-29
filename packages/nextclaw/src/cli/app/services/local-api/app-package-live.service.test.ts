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

  it("fails clearly when the managed host is unavailable", async () => {
    const service = new AppPackageLiveService({ createApiClient: () => null });
    await expect(service.list()).rejects.toThrow("UI runtime is not running");
  });
});
