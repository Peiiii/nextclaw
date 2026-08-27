import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CapabilityGrantManager,
  createCapabilityDeclarationFingerprint,
} from "@kernel/features/capability-grants/index.js";
import { DesktopHostCapabilityManager } from "./desktop-host-capability.manager.js";
import type {
  DesktopHostEvent,
  DesktopHostManifest,
  ResolvedDesktopApplicationTarget,
} from "@kernel/features/desktop-host/types/desktop-host.types.js";

const roots: string[] = [];
const target: ResolvedDesktopApplicationTarget = {
  platform: "darwin",
  applicationId: "wechat",
  bundleId: "com.tencent.xinWeChat",
};

async function createFixture(manifests: DesktopHostManifest[] = [manifest("extension-a")]) {
  const root = await mkdtemp(join(tmpdir(), "nextclaw-desktop-capability-"));
  roots.push(root);
  const capabilityGrantManager = new CapabilityGrantManager(join(root, "grants.json"));
  let eventListener: ((event: DesktopHostEvent) => void) | undefined;
  const invoke = vi.fn(async (method: string) => {
    if (method === "host.application.resolve") return target;
    if (method === "host.ui.observe") return { watchId: "watch-1" };
    if (method === "host.ui.unobserve") return { stopped: true };
    if (method === "host.permissions.get") return { accessibility: "granted" };
    return { ok: true };
  });
  const events = vi.fn();
  const authorizationRequired = vi.fn();
  const manager = new DesktopHostCapabilityManager({
    capabilityGrantManager,
    host: {
      invoke,
      status: vi.fn(),
      dispose: vi.fn(),
      onEvent: (listener: (event: DesktopHostEvent) => void) => {
        eventListener = listener;
        return () => undefined;
      },
    } as never,
    findManifest: (extensionId) => {
      const found = manifests.find((entry) => entry.id === extensionId);
      if (!found) throw new Error(`Extension not found: ${extensionId}`);
      return found;
    },
    hasAgent: (agentId) => agentId === "agent-a" || agentId === "agent-b",
    onAuthorizationRequired: authorizationRequired,
    onEvent: events,
  });
  return {
    capabilityGrantManager,
    authorizationRequired,
    emit: (event: DesktopHostEvent) => eventListener?.(event),
    events,
    invoke,
    manager,
  };
}

function manifest(id: string, access = ["ui.observe"] as const): DesktopHostManifest {
  return {
    id,
    contributes: {
      hostCapabilities: {
        desktopAutomation: { access: [...access] },
      },
    },
  };
}

async function grantObserve(
  capabilityGrantManager: CapabilityGrantManager,
  extensionId = "extension-a",
): Promise<void> {
  await capabilityGrantManager.grant({
    subject: { type: "extension", id: extensionId },
    resource: { type: "desktop.application", target },
    access: ["ui.observe"],
    declarationFingerprint: createCapabilityDeclarationFingerprint({
      access: "ui.observe",
    }),
  });
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, {
    recursive: true,
    force: true,
  })));
});

describe("DesktopHostCapabilityManager", () => {
  it("requires the declared access and a matching target grant", async () => {
    const fixture = await createFixture();

    await expect(fixture.manager.invoke({
      extensionId: "extension-a",
      generation: "generation-1",
      method: "host.ui.observe",
      payload: { target: { applicationId: "wechat" } },
    })).rejects.toMatchObject({
      code: "authorization_required",
      request: expect.objectContaining({
        subject: { type: "extension", id: "extension-a" },
        resource: { type: "desktop.application", target },
        access: ["ui.observe"],
      }),
    });

    await grantObserve(fixture.capabilityGrantManager);
    await expect(fixture.manager.invoke({
      extensionId: "extension-a",
      generation: "generation-1",
      method: "host.ui.observe",
      payload: { target: { applicationId: "wechat" } },
    })).resolves.toEqual({ watchId: "watch-1" });
  });

  it("revalidates Desktop grant requests against the current manifest and resolved target", async () => {
    const fixture = await createFixture();
    const request = {
      subject: { type: "extension", id: "extension-a" },
      resource: { type: "desktop.application", target },
      access: ["ui.observe"],
      declarationFingerprint: createCapabilityDeclarationFingerprint({
        access: "ui.observe",
      }),
    };

    await expect(fixture.manager.grantAccess(request)).resolves.toMatchObject(request);
    await expect(fixture.capabilityGrantManager.list()).resolves.toHaveLength(1);

    for (const forged of [
      { ...request, subject: { type: "panel-app", id: "extension-a" } },
      { ...request, access: ["ui.write"] },
      {
        ...request,
        resource: {
          type: "desktop.application",
          target: { ...target, bundleId: "com.evil.forged" },
        },
      },
      { ...request, declarationFingerprint: "forged" },
    ]) {
      await expect(fixture.manager.grantAccess(forged)).rejects.toThrow();
    }
    await expect(fixture.capabilityGrantManager.list()).resolves.toHaveLength(1);
  });

  it("binds watch events and unobserve ownership to extension generation", async () => {
    const fixture = await createFixture([
      manifest("extension-a"),
      manifest("extension-b"),
    ]);
    await grantObserve(fixture.capabilityGrantManager);
    await grantObserve(fixture.capabilityGrantManager, "extension-b");
    await fixture.manager.invoke({
      extensionId: "extension-a",
      generation: "generation-1",
      method: "host.ui.observe",
      payload: { target: { applicationId: "wechat" } },
    });

    fixture.emit({
      protocolVersion: 1,
      type: "host.event",
      watchId: "watch-1",
      event: { changed: true },
    });
    expect(fixture.events).toHaveBeenCalledWith({
      extensionId: "extension-a",
      generation: "generation-1",
      watchId: "watch-1",
      event: { changed: true },
    });

    for (const input of [
      { extensionId: "extension-b", generation: "generation-1" },
      { extensionId: "extension-a", generation: "generation-2" },
    ]) {
      await expect(fixture.manager.invoke({
        ...input,
        method: "host.ui.unobserve",
        payload: { watchId: "watch-1" },
      })).rejects.toMatchObject({ code: "stale_target" });
    }

    await expect(fixture.manager.invoke({
      extensionId: "extension-a",
      generation: "generation-1",
      method: "host.ui.unobserve",
      payload: { watchId: "watch-1" },
    })).resolves.toEqual({ stopped: true });
  });

  it.each([
    ["canonical target", target],
    ["equivalent target with different key order", {
      bundleId: target.bundleId,
      applicationId: target.applicationId,
      platform: target.platform,
    }],
  ])("stops watches immediately when their grant is revoked with %s", async (_name, revokedTarget) => {
    const fixture = await createFixture();
    await grantObserve(fixture.capabilityGrantManager);
    await fixture.manager.invoke({
      extensionId: "extension-a",
      generation: "generation-1",
      method: "host.ui.observe",
      payload: { target: { applicationId: "wechat" } },
    });

    await fixture.capabilityGrantManager.revoke({
      subject: { type: "extension", id: "extension-a" },
      resourceType: "desktop.application",
      target: revokedTarget,
    });

    expect(fixture.invoke).toHaveBeenCalledWith(
      "host.ui.unobserve",
      { watchId: "watch-1" },
      { extensionId: "extension-a" },
    );
    fixture.events.mockClear();
    fixture.emit({
      protocolVersion: 1,
      type: "host.event",
      watchId: "watch-1",
      event: { changed: true },
    });
    expect(fixture.events).not.toHaveBeenCalled();
  });

  it("keeps observe watches active when a different Desktop access is revoked", async () => {
    const fixture = await createFixture([
      manifest("extension-a", ["ui.read", "ui.observe"]),
    ]);
    await grantObserve(fixture.capabilityGrantManager);
    await fixture.capabilityGrantManager.grant({
      subject: { type: "extension", id: "extension-a" },
      resource: { type: "desktop.application", target },
      access: ["ui.read"],
      declarationFingerprint: createCapabilityDeclarationFingerprint({
        access: "ui.read",
      }),
    });
    await fixture.manager.invoke({
      extensionId: "extension-a",
      generation: "generation-1",
      method: "host.ui.observe",
      payload: { target: { applicationId: "wechat" } },
    });

    await fixture.capabilityGrantManager.revokeMatching((grant) =>
      grant.subject.type === "extension" &&
      grant.subject.id === "extension-a" &&
      grant.resource.type === "desktop.application" &&
      grant.access.includes("ui.read")
    );

    expect(fixture.invoke).not.toHaveBeenCalledWith(
      "host.ui.unobserve",
      { watchId: "watch-1" },
      { extensionId: "extension-a" },
    );
    fixture.emit({
      protocolVersion: 1,
      type: "host.event",
      watchId: "watch-1",
      event: { changed: true },
    });
    expect(fixture.events).toHaveBeenCalledOnce();
  });

  it("cleans only the exiting extension generation watches", async () => {
    const fixture = await createFixture();
    await grantObserve(fixture.capabilityGrantManager);
    await fixture.manager.invoke({
      extensionId: "extension-a",
      generation: "generation-1",
      method: "host.ui.observe",
      payload: { target: { applicationId: "wechat" } },
    });

    await fixture.manager.releaseExtensionWatches("extension-a", "generation-2");
    fixture.emit({
      protocolVersion: 1,
      type: "host.event",
      watchId: "watch-1",
      event: { changed: true },
    });
    expect(fixture.events).toHaveBeenCalledTimes(1);

    await fixture.manager.releaseExtensionWatches("extension-a", "generation-1");
    fixture.events.mockClear();
    fixture.emit({
      protocolVersion: 1,
      type: "host.event",
      watchId: "watch-1",
      event: { changed: false },
    });
    expect(fixture.events).not.toHaveBeenCalled();
  });

  it("allows status without a declaration but protects permission prompts", async () => {
    const fixture = await createFixture([{ id: "extension-a" }]);

    await expect(fixture.manager.invoke({
      extensionId: "extension-a",
      generation: "generation-1",
      method: "host.status",
      payload: {},
    })).resolves.toEqual({ ok: true });
    await expect(fixture.manager.invoke({
      extensionId: "extension-a",
      generation: "generation-1",
      method: "host.permissions.get",
      payload: {},
    })).rejects.toMatchObject({ code: "capability_not_declared" });
  });
});

describe("DesktopHostCapabilityManager Agent access", () => {
  it("uses stable Agent grants across sessions while isolating other Agents", async () => {
    const fixture = await createFixture();
    let request: unknown;
    try {
      await fixture.manager.invokeAgent({
        agentId: "agent-a",
        sessionId: "session-1",
        agentRunId: "run-1",
        method: "host.ui.snapshot",
        payload: { target: { applicationId: "wechat" } },
      });
    } catch (error) {
      request = (error as { request?: unknown }).request;
    }
    expect(request).toMatchObject({
      subject: { type: "agent", id: "agent-a" },
      resource: { type: "desktop.application", target },
      access: ["ui.read"],
    });
    expect(fixture.authorizationRequired).toHaveBeenCalledWith({
      applicationId: "wechat",
      caller: {
        agentId: "agent-a",
        sessionId: "session-1",
        agentRunId: "run-1",
      },
      request,
    });

    await fixture.manager.grantAccess(request as never);
    await expect(fixture.manager.invokeAgent({
      agentId: "agent-a",
      sessionId: "session-2",
      agentRunId: "run-2",
      method: "host.ui.snapshot",
      payload: { target: { applicationId: "wechat" } },
    })).resolves.toEqual({ ok: true });
    expect(fixture.invoke).toHaveBeenLastCalledWith(
      "host.ui.snapshot",
      { target },
      { agentId: "agent-a", sessionId: "session-2", agentRunId: "run-2" },
    );

    await expect(fixture.manager.invokeAgent({
      agentId: "agent-b",
      sessionId: "session-3",
      method: "host.ui.snapshot",
      payload: { target: { applicationId: "wechat" } },
    })).rejects.toMatchObject({
      code: "authorization_required",
      request: expect.objectContaining({
        subject: { type: "agent", id: "agent-b" },
      }),
    });
  });

  it("rejects unknown Agents and non-draft Agent actions before Host execution", async () => {
    const fixture = await createFixture();

    await expect(fixture.manager.invokeAgent({
      agentId: "forged-agent",
      sessionId: "session-1",
      method: "host.status",
      payload: {},
    })).rejects.toMatchObject({ code: "authorization_denied" });

    fixture.invoke.mockClear();
    await expect(fixture.manager.invokeAgent({
      agentId: "agent-a",
      sessionId: "session-1",
      method: "host.ui.action",
      payload: {
        target: { applicationId: "wechat" },
        action: { type: "press", path: [0] },
      },
    })).rejects.toMatchObject({ code: "operation_not_supported" });
    expect(fixture.invoke).not.toHaveBeenCalled();
  });

  it("allows only the bounded desktop tool to press after the same ui.write grant", async () => {
    const fixture = await createFixture();
    await fixture.capabilityGrantManager.grant({
      subject: { type: "agent", id: "agent-a" },
      resource: { type: "desktop.application", target },
      access: ["ui.write"],
      declarationFingerprint: createCapabilityDeclarationFingerprint({
        contractVersion: 1,
        access: "ui.write",
      }),
    });

    await expect(fixture.manager.invokeAgent({
      agentId: "agent-a",
      sessionId: "session-1",
      source: "desktop",
      method: "host.ui.action",
      payload: {
        target: { applicationId: "wechat" },
        action: { type: "press", path: [0] },
      },
    })).resolves.toEqual({ ok: true });
    expect(fixture.invoke).toHaveBeenLastCalledWith(
      "host.ui.action",
      { target, action: { type: "press", path: [0] } },
      { agentId: "agent-a", sessionId: "session-1" },
    );
  });

  it("requires a separate screen-capture grant for Agent visual snapshots", async () => {
    const fixture = await createFixture();
    let request: unknown;
    try {
      await fixture.manager.invokeAgent({
        agentId: "agent-a",
        sessionId: "session-1",
        method: "host.screen.captureWindow",
        payload: { target: { applicationId: "wechat" } },
      });
    } catch (error) {
      request = (error as { request?: unknown }).request;
    }
    expect(request).toMatchObject({
      subject: { type: "agent", id: "agent-a" },
      resource: { type: "desktop.application", target },
      access: ["screen.capture-window"],
    });

    await fixture.manager.grantAccess(request as never);
    await expect(fixture.manager.invokeAgent({
      agentId: "agent-a",
      sessionId: "session-2",
      method: "host.screen.captureWindow",
      payload: { target: { applicationId: "wechat" } },
    })).resolves.toEqual({ ok: true });
  });

  it("requires a separate pointer grant for screenshot-backed Agent clicks", async () => {
    const fixture = await createFixture();
    let request: unknown;
    try {
      await fixture.manager.invokeAgent({
        agentId: "agent-a",
        sessionId: "session-1",
        method: "host.input.click",
        payload: { target: { applicationId: "wechat" }, coordinate: { x: 100, y: 200 } },
      });
    } catch (error) {
      request = (error as { request?: unknown }).request;
    }
    expect(request).toMatchObject({
      subject: { type: "agent", id: "agent-a" },
      resource: { type: "desktop.application", target },
      access: ["input.pointer"],
    });

    await fixture.manager.grantAccess(request as never);
    await expect(fixture.manager.invokeAgent({
      agentId: "agent-a",
      sessionId: "session-2",
      method: "host.input.click",
      payload: { target: { applicationId: "wechat" }, coordinate: { x: 100, y: 200 } },
    })).resolves.toEqual({ ok: true });
  });
});
