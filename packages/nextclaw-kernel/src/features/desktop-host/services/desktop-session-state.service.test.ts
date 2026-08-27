import { describe, expect, it, vi } from "vitest";
import { DesktopSessionStateService } from "./desktop-session-state.service.js";

const caller = { agentId: "agent-a", sessionId: "session-a", agentRunId: "run-a" };
const target = { applicationId: "wechat" };
const safeSnapshot = { role: "window", children: [{ role: "button", title: "More" }] };

function fixture(snapshots: unknown[] = [safeSnapshot, safeSnapshot]) {
  const invokeAgent = vi.fn(async (input: { method: string }) => {
    if (input.method === "host.ui.snapshot") return snapshots.shift() ?? safeSnapshot;
    if (input.method === "host.screen.captureWindow") {
      return {
        window: { position: { x: 20, y: 30 }, size: { width: 400, height: 300 } },
        image: { data: "screen" },
      };
    }
    return { ok: true };
  });
  return { invokeAgent, service: new DesktopSessionStateService({ invokeAgent } as never) };
}

describe("DesktopSessionStateService", () => {
  it("returns an indexed AX snapshot and allows a fresh AX click", async () => {
    const subject = fixture();
    const snapshot = await subject.service.snapshot(caller, { target }) as { stateId: string; accessibility: { text: string } };
    expect(snapshot.accessibility.text).toContain("[1]");

    await expect(subject.service.click(caller, {
      target,
      stateId: snapshot.stateId,
      elementIndex: 1,
    })).resolves.toMatchObject({ operation: "click", stateInvalidated: true });
    expect(subject.invokeAgent).toHaveBeenLastCalledWith(expect.objectContaining({
      source: "desktop",
      method: "host.ui.action",
      payload: { target, action: { type: "press", path: [0] } },
    }));
  });

  it("rejects a changed element before it can reach the action host call", async () => {
    const subject = fixture([safeSnapshot, { role: "window", children: [{ role: "textArea", title: "More changed" }] }]);
    const snapshot = await subject.service.snapshot(caller, { target }) as { stateId: string };

    await expect(subject.service.click(caller, { target, stateId: snapshot.stateId, elementIndex: 1 }))
      .rejects.toMatchObject({ code: "stale_state" });
    expect(subject.invokeAgent).toHaveBeenCalledTimes(2);
  });

  it("allows dynamic element text changes when the captured element remains structurally stable", async () => {
    const subject = fixture([safeSnapshot, { role: "window", children: [{ role: "button", title: "More changed" }] }]);
    const snapshot = await subject.service.snapshot(caller, { target }) as { stateId: string };

    await expect(subject.service.click(caller, { target, stateId: snapshot.stateId, elementIndex: 1 }))
      .resolves.toMatchObject({ operation: "click" });
  });

  it("reuses the initial AX bounds when refreshing state before an action", async () => {
    const subject = fixture();
    const snapshot = await subject.service.snapshot(caller, {
      target,
      maxDepth: 4,
      maxNodes: 200,
    }) as { stateId: string };
    await subject.service.click(caller, { target, stateId: snapshot.stateId, elementIndex: 1 });
    expect(subject.invokeAgent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      method: "host.ui.snapshot",
      payload: { target, maxDepth: 4, maxNodes: 200 },
    }));
    expect(subject.invokeAgent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      method: "host.ui.snapshot",
      payload: { target, maxDepth: 4, maxNodes: 200 },
    }));
  });

  it("allows a fresh AX send click and multiline value", async () => {
    const subject = fixture([
      { role: "window", children: [{ role: "button", title: "Send" }] },
      { role: "window", children: [{ role: "button", title: "Send" }] },
    ]);
    const snapshot = await subject.service.snapshot(caller, { target }) as { stateId: string };
    await expect(subject.service.click(caller, { target, stateId: snapshot.stateId, elementIndex: 1 }))
      .resolves.toMatchObject({ operation: "click", stateInvalidated: true });
    expect(subject.invokeAgent).toHaveBeenLastCalledWith(expect.objectContaining({
      method: "host.ui.action",
      payload: { target, action: { type: "press", path: [0] } },
    }));

    const mixed = fixture([
      { role: "window", children: [{ role: "button", title: "Show details — Send" }] },
      { role: "window", children: [{ role: "button", title: "Show details — Send" }] },
    ]);
    const mixedSnapshot = await mixed.service.snapshot(caller, { target }) as { stateId: string };
    await expect(mixed.service.click(caller, { target, stateId: mixedSnapshot.stateId, elementIndex: 1 }))
      .resolves.toMatchObject({ operation: "click", stateInvalidated: true });

    const text = fixture([
      { role: "window", children: [{ role: "textArea", title: "Draft" }] },
      { role: "window", children: [{ role: "textArea", title: "Draft" }] },
    ]);
    const textSnapshot = await text.service.snapshot(caller, { target }) as { stateId: string };
    await expect(text.service.setValue(caller, {
      target, stateId: textSnapshot.stateId, elementIndex: 1, value: "one\ntwo",
    })).resolves.toMatchObject({ operation: "set_value", stateInvalidated: true });
    expect(text.invokeAgent).toHaveBeenLastCalledWith(expect.objectContaining({
      method: "host.ui.action",
      payload: { target, action: { type: "setValue", path: [0], value: "one\ntwo" } },
    }));
  });

  it("invalidates a state after a write", async () => {
    const subject = fixture([
      { role: "window", children: [{ role: "textArea", title: "Draft" }] },
      { role: "window", children: [{ role: "textArea", title: "Draft" }] },
    ]);
    const snapshot = await subject.service.snapshot(caller, { target }) as { stateId: string };
    await subject.service.setValue(caller, { target, stateId: snapshot.stateId, elementIndex: 1, value: " hello " });
    expect(subject.invokeAgent).toHaveBeenLastCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ action: expect.objectContaining({ value: " hello " }) }),
    }));
    await expect(subject.service.setValue(caller, { target, stateId: snapshot.stateId, elementIndex: 1, value: "again" }))
      .rejects.toMatchObject({ code: "stale_state" });
  });

  it("permits clearing an authorized text field", async () => {
    const subject = fixture([
      { role: "window", children: [{ role: "textArea", title: "Draft" }] },
      { role: "window", children: [{ role: "textArea", title: "Draft" }] },
    ]);
    const snapshot = await subject.service.snapshot(caller, { target }) as { stateId: string };
    await expect(subject.service.setValue(caller, {
      target, stateId: snapshot.stateId, elementIndex: 1, value: "",
    })).resolves.toMatchObject({ operation: "set_value", stateInvalidated: true });
    expect(subject.invokeAgent).toHaveBeenLastCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ action: expect.objectContaining({ value: "" }) }),
    }));
  });

  it("translates a fresh screenshot-relative coordinate click into its captured window", async () => {
    const subject = fixture();
    const snapshot = await subject.service.snapshot(caller, { target, source: "both" }) as { stateId: string };
    await expect(subject.service.click(caller, {
      target, stateId: snapshot.stateId, coordinate: { x: 100, y: 200 },
    })).resolves.toMatchObject({ operation: "click", stateInvalidated: true });
    expect(subject.invokeAgent).toHaveBeenLastCalledWith(expect.objectContaining({
      source: "desktop", method: "host.input.click", payload: {
        target,
        coordinate: { x: 120, y: 230 },
        window: { position: { x: 20, y: 30 }, size: { width: 400, height: 300 } },
      },
    }));
    await expect(subject.service.click(caller, {
      target, stateId: snapshot.stateId, coordinate: { x: 100, y: 200 },
    })).rejects.toMatchObject({ code: "stale_state" });

    const outside = fixture();
    const outsideSnapshot = await outside.service.snapshot(caller, { target, source: "both" }) as { stateId: string };
    await expect(outside.service.click(caller, {
      target, stateId: outsideSnapshot.stateId, coordinate: { x: 999, y: 200 },
    })).rejects.toMatchObject({ code: "operation_not_supported" });
  });

  it("keeps the host-issued process and window locator across a screen action", async () => {
    const locator = { bundleId: "com.tencent.xinWeChat", pid: 42, windowId: 99 };
    const invokeAgent = vi.fn(async (input: { method: string }) => {
      if (input.method === "host.ui.snapshot") return { ...safeSnapshot, targetLocator: locator };
      if (input.method === "host.screen.captureWindow") {
        return {
          target: locator,
          window: { position: { x: 20, y: 30 }, size: { width: 400, height: 300 } },
          image: { data: "screen", width: 400, height: 300 },
        };
      }
      return { ok: true };
    });
    const service = new DesktopSessionStateService({ invokeAgent } as never);
    const snapshot = await service.snapshot(caller, { target, source: "both" }) as { stateId: string };

    await service.click(caller, {
      target,
      stateId: snapshot.stateId,
      coordinate: { x: 100, y: 200 },
    });

    expect(invokeAgent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      method: "host.ui.snapshot",
      payload: { target, locator },
    }));
    expect(invokeAgent).toHaveBeenNthCalledWith(3, expect.objectContaining({
      method: "host.screen.captureWindow",
      payload: { target, locator },
    }));
    expect(invokeAgent).toHaveBeenLastCalledWith(expect.objectContaining({
      method: "host.input.click",
      payload: expect.objectContaining({ target, locator }),
    }));
  });

  it("does not treat dynamic OCR text as a coordinate-state change", async () => {
    let screenReads = 0;
    const invokeAgent = vi.fn(async (input: { method: string }) => {
      if (input.method === "host.ui.snapshot") return safeSnapshot;
      if (input.method === "host.screen.captureWindow") {
        screenReads += 1;
        return {
          window: { position: { x: 20, y: 30 }, size: { width: 400, height: 300 } },
          ocrText: `dynamic counter ${screenReads}`,
          image: { data: `frame-${screenReads}`, width: 400, height: 300 },
        };
      }
      return { ok: true };
    });
    const service = new DesktopSessionStateService({ invokeAgent } as never);
    const snapshot = await service.snapshot(caller, { target, source: "both" }) as { stateId: string };

    await expect(service.click(caller, {
      target,
      stateId: snapshot.stateId,
      coordinate: { x: 100, y: 200 },
    })).resolves.toMatchObject({ operation: "click" });
    expect(invokeAgent).toHaveBeenLastCalledWith(expect.objectContaining({
      method: "host.input.click",
      payload: {
        target,
        coordinate: { x: 120, y: 230 },
        window: { position: { x: 20, y: 30 }, size: { width: 400, height: 300 } },
      },
    }));
  });

  it("types only from a fresh screen state and invalidates that state afterwards", async () => {
    const subject = fixture();
    const snapshot = await subject.service.snapshot(caller, { target, source: "screen", detail: "low" }) as { stateId: string };

    await expect(subject.service.typeText(caller, {
      target,
      stateId: snapshot.stateId,
      text: "safe draft",
    })).resolves.toMatchObject({ operation: "type_text", stateInvalidated: true });
    expect(subject.invokeAgent).toHaveBeenLastCalledWith(expect.objectContaining({
      source: "desktop",
      method: "host.input.typeText",
      payload: { target, text: "safe draft" },
    }));
    await expect(subject.service.typeText(caller, {
      target,
      stateId: snapshot.stateId,
      text: "again",
    })).rejects.toMatchObject({ code: "stale_state" });
  });

  it("preserves newline keyboard input for the native target", async () => {
    const subject = fixture();
    const snapshot = await subject.service.snapshot(caller, { target, source: "screen" }) as { stateId: string };

    await expect(subject.service.typeText(caller, {
      target,
      stateId: snapshot.stateId,
      text: "first line\nsecond line",
    })).resolves.toMatchObject({ operation: "type_text", stateInvalidated: true });
    expect(subject.invokeAgent).toHaveBeenLastCalledWith(expect.objectContaining({
      method: "host.input.typeText",
      payload: { target, text: "first line\nsecond line" },
    }));
  });

  it("presses a bounded key chord only from a fresh screen state", async () => {
    const subject = fixture();
    const snapshot = await subject.service.snapshot(caller, { target, source: "screen", detail: "low" }) as { stateId: string };

    await expect(subject.service.pressKey(caller, {
      target,
      stateId: snapshot.stateId,
      key: "f",
      modifiers: ["command"],
    })).resolves.toMatchObject({ operation: "press_key", stateInvalidated: true });
    expect(subject.invokeAgent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      method: "host.screen.captureWindow",
      payload: { target, detail: "low" },
    }));
    expect(subject.invokeAgent).toHaveBeenLastCalledWith(expect.objectContaining({
      source: "desktop",
      method: "host.input.pressKey",
      payload: { target, key: "f", modifiers: ["command"] },
    }));
  });
});
