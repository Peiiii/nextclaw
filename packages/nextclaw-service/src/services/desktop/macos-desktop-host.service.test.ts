import { describe, expect, it, vi } from "vitest";
import { MacosAccessibilityService } from "@nextclaw-service/services/desktop/macos-accessibility.service.js";
import { MacosDesktopHostOperations } from "@nextclaw-service/services/desktop/macos-desktop-host.service.js";

function createHost() {
  let observer: ((event: { notification?: string }) => void) | undefined;
  const adapter = {
    isTrusted: () => true,
    isScreenCaptureTrusted: () => true,
    requestScreenCapturePermission: () => true,
    recognizeText: vi.fn(() => "窗口文字"),
    resolveApplication: (bundleId: string) => ({ bundleId, pid: 1, name: "WeChat" }),
    snapshot: vi.fn(() => ({ role: "AXApplication", children: [] })),
    observe: vi.fn((_bundleId: string, callback: (event: { notification?: string }) => void) => {
      observer = callback;
      return "native-watch";
    }),
    unobserve: vi.fn(() => true),
    performAction: vi.fn(() => ({ succeeded: true })),
    clickAt: vi.fn(() => ({ succeeded: true })),
    typeText: vi.fn(() => ({ succeeded: true })),
    pressKey: vi.fn(() => ({ succeeded: true })),
    resolveWindow: vi.fn(() => ({
      pid: 1,
      windowId: 9,
      window: { position: { x: 10, y: 20 }, size: { width: 300, height: 200 } },
    })),
    resolveCaptureWindow: vi.fn(async () => ({
      pid: 1,
      windowId: 9,
      window: { position: { x: 10, y: 20 }, size: { width: 300, height: 200 } },
    })),
    captureWindow: vi.fn(async () => ({ mimeType: "image/png" as const, data: "png", width: 300, height: 200 })),
    captureApplicationWindow: vi.fn(async () => ({
      pid: 1,
      windowId: 9,
      window: { position: { x: 10, y: 20 }, size: { width: 300, height: 200 } },
      mimeType: "image/png" as const,
      data: "png",
      width: 300,
      height: 200,
    })),
  };
  const host = new MacosDesktopHostOperations({
    accessibility: new MacosAccessibilityService({ adapter: adapter as never }),
    openExternal: vi.fn(async () => undefined),
  });
  return { adapter, emitNativeEvent: (event: { notification?: string }) => observer?.(event), host };
}

describe("MacosDesktopHostService", () => {
  it("serves Desktop operations directly without a socket or a window host", async () => {
    const { adapter, host } = createHost();
    await expect(host.invoke("host.application.resolve", { target: { applicationId: "wechat" } }, {}))
      .resolves.toMatchObject({ bundleId: "com.tencent.xinWeChat" });
    await expect(host.invoke("host.ui.snapshot", {
      target: { bundleId: "com.tencent.xinWeChat" },
      maxDepth: 8,
    }, {})).resolves.toMatchObject({ role: "AXApplication" });
    await expect(host.invoke("host.screen.captureWindow", {
      target: { bundleId: "com.tencent.xinWeChat" },
    }, {})).resolves.toMatchObject({ ocrText: "窗口文字", image: { data: "png" } });
    expect(adapter.snapshot).toHaveBeenCalledWith("com.tencent.xinWeChat", { maxDepth: 8, maxNodes: 500, pid: 1 });
    expect(adapter.captureApplicationWindow).toHaveBeenCalledWith("com.tencent.xinWeChat", {});
  });

  it("passes requested screen detail through capture and OCR", async () => {
    const { adapter, host } = createHost();
    await host.invoke("host.screen.captureWindow", {
      target: { bundleId: "com.tencent.xinWeChat" },
      detail: "low",
    }, {});
    expect(adapter.captureApplicationWindow).toHaveBeenCalledWith("com.tencent.xinWeChat", { detail: "low" });
    expect(adapter.recognizeText).toHaveBeenCalledWith("png", { detail: "low" });
  });

  it("keeps an AX snapshot bound to the captured process", async () => {
    const { adapter, host } = createHost();
    await expect(host.invoke("host.ui.snapshot", {
      target: { bundleId: "com.tencent.xinWeChat" },
      locator: { bundleId: "com.tencent.xinWeChat", pid: 1, windowId: 9 },
    }, {})).resolves.toMatchObject({ targetLocator: { pid: 1, windowId: 9 } });
    expect(adapter.resolveCaptureWindow).toHaveBeenCalledWith("com.tencent.xinWeChat", { pid: 1 });
    expect(adapter.snapshot).toHaveBeenCalledWith("com.tencent.xinWeChat", { maxDepth: 12, maxNodes: 500, pid: 1 });
  });

  it("passes multiline keyboard text through without product-level semantic filtering", async () => {
    const { adapter, host } = createHost();
    await expect(host.invoke("host.input.typeText", {
      target: { bundleId: "com.tencent.xinWeChat" },
      text: "first line\nsecond line",
    }, {})).resolves.toEqual({ succeeded: true });
    expect(adapter.typeText).toHaveBeenCalledWith("com.tencent.xinWeChat", {
      text: "first line\nsecond line",
      pid: 1,
      windowId: 9,
    });
  });

  it("passes a state-bound keyboard chord without inferring product semantics", async () => {
    const { adapter, host } = createHost();
    await expect(host.invoke("host.input.pressKey", {
      target: { bundleId: "com.tencent.xinWeChat" },
      key: "f",
      modifiers: ["command"],
    }, {})).resolves.toEqual({ succeeded: true });
    expect(adapter.pressKey).toHaveBeenCalledWith("com.tencent.xinWeChat", {
      key: "f",
      modifiers: ["command"],
      pid: 1,
      windowId: 9,
    });
  });

  it("owns native watches and forwards them through the Host contract", async () => {
    const { adapter, emitNativeEvent, host } = createHost();
    const received = vi.fn();
    host.onEvent(received);
    const watch = await host.invoke<{ watchId: string }>("host.ui.observe", {
      target: { bundleId: "com.tencent.xinWeChat" },
    }, {});
    emitNativeEvent({ notification: "AXFocusedWindowChanged" });
    expect(received).toHaveBeenCalledWith(expect.objectContaining({
      type: "host.event",
      watchId: watch.watchId,
      event: expect.objectContaining({ type: "snapshotChanged" }),
    }));
    await expect(host.invoke("host.ui.unobserve", { watchId: watch.watchId }, {}))
      .resolves.toEqual({ stopped: true });
    expect(adapter.unobserve).toHaveBeenCalledWith("native-watch");
  });
});
