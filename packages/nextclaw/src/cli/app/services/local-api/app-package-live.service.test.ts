import { describe, expect, it, vi } from "vitest";
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
      body: { source: "./local-app", registryUrl: undefined },
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

  it("fails clearly when the managed host is unavailable", async () => {
    const service = new AppPackageLiveService({ createApiClient: () => null });
    await expect(service.list()).rejects.toThrow("UI runtime is not running");
  });
});
