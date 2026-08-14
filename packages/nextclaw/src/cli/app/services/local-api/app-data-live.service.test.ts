import { describe, expect, it, vi } from "vitest";
import { AppDataLiveService } from "./app-data-live.service.js";

describe("AppDataLiveService", () => {
  it("uses the running host for list and confirmed retained deletion", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ entries: [], diagnostics: [] })
      .mockResolvedValueOnce({
        deleted: true,
        id: "ad1.encoded",
        appId: "example.notes",
        instanceId: "default",
      });
    const service = new AppDataLiveService({
      createApiClient: () => ({ request }),
    });

    await expect(service.list()).resolves.toEqual({ entries: [], diagnostics: [] });
    await expect(service.deleteRetained("ad1.encoded", "example.notes"))
      .resolves.toMatchObject({ deleted: true, appId: "example.notes" });
    expect(request).toHaveBeenNthCalledWith(1, { path: "/api/app-data" });
    expect(request).toHaveBeenNthCalledWith(2, {
      path: "/api/app-data/ad1.encoded",
      method: "DELETE",
      body: { confirmAppId: "example.notes" },
    });
  });

  it("fails fast when the live host is unavailable", async () => {
    const service = new AppDataLiveService({ createApiClient: () => null });
    await expect(service.list()).rejects.toThrow("not running");
  });
});
