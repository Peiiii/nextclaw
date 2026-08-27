import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type {
  CapabilityGrantFilter,
  CapabilityGrantRequest,
} from "@nextclaw/kernel";
import { CapabilityAccessRoutesController } from "./capability-access.controller.js";

function createFixture() {
  const grant = vi.fn(async (request: CapabilityGrantRequest) => ({
    ...request,
    grantedAt: "2026-08-26T00:00:00.000Z",
  }));
  const grantAccess = vi.fn(async (request: CapabilityGrantRequest) => ({
    ...request,
    grantedAt: "2026-08-26T00:00:00.000Z",
  }));
  const list = vi.fn(async (_filter?: CapabilityGrantFilter) => []);
  const revoke = vi.fn(async (_filter: CapabilityGrantFilter) => []);
  const status = vi.fn(async () => ({
    online: true,
    platform: "darwin" as const,
    supportedAccess: ["ui.read" as const],
    supportedOperations: ["host.status" as const],
    permissions: { accessibility: "granted" as const, screenCapture: "not_supported" as const },
  }));
  const getPermissions = vi.fn(async () => ({
    accessibility: "granted" as const,
    screenCapture: "not_supported" as const,
  }));
  const requestPermissions = vi.fn(async () => ({
    accessibility: "granted" as const,
    screenCapture: "not_supported" as const,
  }));
  const openPermissionSettings = vi.fn(async () => ({ opened: true }));
  const controller = new CapabilityAccessRoutesController({
    capabilityGrantManager: { grant, list, revoke } as never,
    getDesktopHost: () => ({
      status,
      grantAccess,
      getPermissions,
      requestPermissions,
      openPermissionSettings,
    }),
  });
  const app = new Hono();
  app.get("/api/capability-grants", controller.listGrants);
  app.post("/api/capability-grants", controller.grant);
  app.delete("/api/capability-grants", controller.revoke);
  app.get("/api/desktop-host/status", controller.getDesktopStatus);
  app.get("/api/desktop-host/permissions", controller.getDesktopPermissions);
  app.post("/api/desktop-host/permissions/request", controller.requestDesktopPermissions);
  app.post("/api/desktop-host/permissions/open-settings", controller.openDesktopPermissionSettings);
  return {
    app,
    getPermissions,
    grant,
    grantAccess,
    list,
    openPermissionSettings,
    requestPermissions,
    revoke,
    status,
  };
}

const grantRequest = {
  subject: { type: "extension", id: "wechat-desktop-observation" },
  resource: {
    type: "desktop.application",
    target: {
      applicationId: "wechat",
      bundleId: "com.tencent.xinWeChat",
      platform: "darwin",
    },
  },
  access: ["ui.observe"],
  declarationFingerprint: "fingerprint",
};

describe("CapabilityAccessRoutesController", () => {
  it("lists grants with bounded query filters", async () => {
    const fixture = createFixture();
    const response = await fixture.app.request(
      "http://localhost/api/capability-grants?subjectType=extension&subjectId=wechat-desktop-observation&resourceType=desktop.application",
    );

    expect(response.status).toBe(200);
    expect(fixture.list).toHaveBeenCalledWith({
      subject: { type: "extension", id: "wechat-desktop-observation" },
      resourceType: "desktop.application",
    });
  });

  it("lists all Desktop grants for the authenticated settings surface", async () => {
    const fixture = createFixture();
    const response = await fixture.app.request(
      "http://localhost/api/capability-grants?resourceType=desktop.application",
    );

    expect(response.status).toBe(200);
    expect(fixture.list).toHaveBeenCalledWith({
      resourceType: "desktop.application",
    });
  });

  it.each([
    "http://localhost/api/capability-grants?subjectType=extension",
    "http://localhost/api/capability-grants?subjectId=wechat-desktop-observation",
  ])("rejects incomplete Desktop grant subject filters", async (url) => {
    const fixture = createFixture();
    const response = await fixture.app.request(url);

    expect(response.status).toBe(400);
    expect(fixture.list).not.toHaveBeenCalled();
  });

  it("grants only a complete exact capability request", async () => {
    const fixture = createFixture();
    const response = await fixture.app.request("http://localhost/api/capability-grants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(grantRequest),
    });

    expect(response.status).toBe(201);
    expect(fixture.grantAccess).toHaveBeenCalledWith(grantRequest);
    expect(fixture.grant).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { grantedAt: "2026-08-26T00:00:00.000Z" },
    });
  });

  it.each([
    null,
    {},
    { ...grantRequest, extra: true },
    { ...grantRequest, access: [] },
    { ...grantRequest, resource: { type: "desktop.application" } },
  ])("rejects malformed grant requests", async (body) => {
    const fixture = createFixture();
    const response = await fixture.app.request("http://localhost/api/capability-grants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(400);
    expect(fixture.grantAccess).not.toHaveBeenCalled();
    expect(fixture.grant).not.toHaveBeenCalled();
  });

  it("rejects direct grants for resources without a resource-specific validator", async () => {
    const fixture = createFixture();
    const response = await fixture.app.request("http://localhost/api/capability-grants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...grantRequest,
        resource: { type: "service.action", target: { actionId: "notes.write" } },
        access: ["invoke"],
      }),
    });

    expect(response.status).toBe(400);
    expect(fixture.grantAccess).not.toHaveBeenCalled();
    expect(fixture.grant).not.toHaveBeenCalled();
  });

  it("revokes only when a complete exact selector is supplied", async () => {
    const fixture = createFixture();
    const response = await fixture.app.request("http://localhost/api/capability-grants", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subject: { type: "extension", id: "wechat-desktop-observation" },
        resourceType: "desktop.application",
        target: grantRequest.resource.target,
        access: grantRequest.access,
      }),
    });

    expect(response.status).toBe(200);
    expect(fixture.revoke).toHaveBeenCalledWith({
      subject: { type: "extension", id: "wechat-desktop-observation" },
      resourceType: "desktop.application",
      target: grantRequest.resource.target,
      access: grantRequest.access,
    });

    for (const body of [
      {},
      { subject: { type: "extension", id: "wechat-desktop-observation" } },
      {
        subject: { type: "extension", id: "wechat-desktop-observation" },
        resourceType: "desktop.application",
      },
    ]) {
      const invalid = await fixture.app.request("http://localhost/api/capability-grants", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(invalid.status).toBe(400);
    }
    expect(fixture.revoke).toHaveBeenCalledTimes(1);
  });

  it("delegates Desktop status and system-permission actions to the runtime host", async () => {
    const fixture = createFixture();
    for (const [path, method] of [
      ["/api/desktop-host/status", "GET"],
      ["/api/desktop-host/permissions", "GET"],
      ["/api/desktop-host/permissions/request", "POST"],
      ["/api/desktop-host/permissions/open-settings", "POST"],
    ] as const) {
      const response = await fixture.app.request(`http://localhost${path}`, { method });
      expect(response.status).toBe(200);
      const payload = await response.json() as { ok: boolean };
      expect(payload.ok).toBe(true);
    }
    expect(fixture.status).toHaveBeenCalledOnce();
    expect(fixture.getPermissions).toHaveBeenCalledOnce();
    expect(fixture.requestPermissions).toHaveBeenCalledOnce();
    expect(fixture.openPermissionSettings).toHaveBeenCalledOnce();
  });
});
