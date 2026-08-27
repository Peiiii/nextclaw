import { describe, expect, it } from "vitest";
import { FeatureControlsService } from "./feature-controls.service.js";

describe("FeatureControlsService", () => {
  it("derives desktop exposure from the backend Host contract", async () => {
    const supported = new FeatureControlsService({
      status: async () => ({
        online: true,
        platform: "darwin",
        supportedAccess: ["ui.read"],
        supportedOperations: ["host.status", "host.ui.snapshot"],
        permissions: { accessibility: "not_granted", screenCapture: "not_granted" },
      }),
    } as never);
    const unsupported = new FeatureControlsService({
      status: async () => ({
        online: true,
        platform: "win32",
        supportedAccess: [],
        supportedOperations: ["host.status"],
        permissions: { accessibility: "not_supported", screenCapture: "not_supported" },
      }),
    } as never);

    await expect(supported.get()).resolves.toEqual({ desktopAutomation: { available: true } });
    await expect(unsupported.get()).resolves.toEqual({ desktopAutomation: { available: false } });
  });
});
