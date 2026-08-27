import { describe, expect, it, vi } from "vitest";
import { WechatDesktopObservationService } from "../services/wechat-desktop-observation.service.js";
import {
  findNewWechatMessages,
  normalizeWechatObservationConfig,
  toWechatDesktopSnapshot,
} from "../utils/wechat-desktop-snapshot.utils.js";

describe("WeChat Desktop observation", () => {
  it("extracts bounded visible messages and ignores NextClaw self messages", () => {
    const config = normalizeWechatObservationConfig({ maxItems: 2 });
    const snapshot = toWechatDesktopSnapshot({
      config,
      capturedAt: "2026-08-26T00:00:00.000Z",
      root: {
        role: "AXWindow",
        children: [
          { role: "AXStaticText", value: "older" },
          { role: "AXStaticText", value: "hello" },
          { role: "AXStaticText", value: "🤖[墨爪] sent by us" },
          { role: "AXStaticText", value: "newest" },
        ],
      },
    });

    expect(snapshot.messages.map((message) => message.text)).toEqual([
      "hello",
      "newest",
    ]);
  });

  it("identifies newly visible message identities", () => {
    const config = normalizeWechatObservationConfig({});
    const previous = toWechatDesktopSnapshot({
      config,
      root: { role: "AXWindow", children: [{ role: "AXStaticText", value: "one" }] },
    });
    const next = toWechatDesktopSnapshot({
      config,
      root: {
        role: "AXWindow",
        children: [
          { role: "AXStaticText", value: "one" },
          { role: "AXStaticText", value: "two" },
        ],
      },
    });
    expect(findNewWechatMessages(previous, next).map((item) => item.text)).toEqual(["two"]);
  });

  it("owns one Host watch per Observation subscription and releases it", async () => {
    let eventHandler: ((event: { watchId: string; event: unknown }) => void) | undefined;
    const invoke = vi.fn(async (input: { method: string }) => {
      if (input.method === "host.ui.snapshot") {
        return { role: "AXWindow", children: [] };
      }
      if (input.method === "host.ui.observe") return { watchId: "watch-a" };
      return { stopped: true };
    });
    const service = new WechatDesktopObservationService({
      invoke,
      status: vi.fn(),
      onEvent: (handler: typeof eventHandler) => {
        eventHandler = handler;
        return () => undefined;
      },
    } as never);
    const cleanup = await service.handlers.subscribe?.({
      subscriptionId: "subscription-a",
      config: {},
      emit: vi.fn(),
      signal: new AbortController().signal,
    });

    expect(invoke).toHaveBeenCalledWith(expect.objectContaining({
      method: "host.ui.observe",
      caller: { subscriptionId: "subscription-a" },
    }));
    await cleanup?.();
    expect(invoke).toHaveBeenCalledWith({
      method: "host.ui.unobserve",
      payload: { watchId: "watch-a" },
      caller: { subscriptionId: "subscription-a" },
    });
    expect(eventHandler).toBeTypeOf("function");
  });
});
