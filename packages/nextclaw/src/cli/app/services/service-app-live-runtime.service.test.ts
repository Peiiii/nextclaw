import { describe, expect, it, vi } from "vitest";
import { ServiceAppLiveRuntimeService } from "./service-app-live-runtime.service.js";

describe("ServiceAppLiveRuntimeService", () => {
  it("restarts a live service app through the local UI API", async () => {
    const request = vi.fn().mockResolvedValue({
      id: "notes",
      title: "Notes",
      dirPath: "/workspace/service-apps/notes",
      manifestPath: "/workspace/service-apps/notes/service-app.json",
      command: "node",
      args: ["server.mjs"],
      cwd: "/workspace/service-apps/notes",
      enabled: true,
      protocol: "mcp",
      status: "idle",
    });

    const report = await new ServiceAppLiveRuntimeService({
      createApiClient: () => ({ request }),
    }).restart(" notes ");

    expect(report.ok).toBe(true);
    expect(report.app?.status).toBe("idle");
    expect(request).toHaveBeenCalledWith({
      path: "/api/service-apps/notes/restart",
      method: "POST",
    });
  });

  it("reports a missing live runtime", async () => {
    const report = await new ServiceAppLiveRuntimeService({
      createApiClient: () => null,
    }).restart("notes");

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual([
      expect.objectContaining({
        code: "service.runtime.notRunning",
      }),
    ]);
  });
});
