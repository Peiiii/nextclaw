import { describe, expect, it, vi } from "vitest";
import { CapabilityAccessService } from "./capability-access.service.js";

describe("CapabilityAccessService", () => {
  it("uses the resource-specific Desktop grant endpoints", async () => {
    const get = vi.fn(async () => []);
    const post = vi.fn(async () => ({ opened: true }));
    const request = vi.fn(async () => ({ revoked: [] }));
    const service = new CapabilityAccessService({ get, post, request } as never);

    await service.listDesktopGrants();
    await service.openDesktopPermissionSettings();
    await service.revokeDesktopAccess({
      subject: { type: "agent", id: "main" },
      resource: {
        type: "desktop.application",
        target: { platform: "darwin", applicationId: "wechat", bundleId: "com.tencent.xinWeChat" },
      },
      access: ["ui.read"],
      declarationFingerprint: "fingerprint",
      grantedAt: "2026-08-26T00:00:00.000Z",
    });

    expect(get).toHaveBeenCalledWith(
      "/api/capability-grants?resourceType=desktop.application",
    );
    expect(post).toHaveBeenCalledWith(
      "/api/desktop-host/permissions/open-settings",
      {},
    );
    expect(request).toHaveBeenCalledWith(
      "/api/capability-grants",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
