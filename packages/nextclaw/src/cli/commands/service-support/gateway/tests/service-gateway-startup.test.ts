import { describe, expect, it, vi } from "vitest";
import { wireSystemSessionUpdatedPublisher } from "../service-gateway-startup.js";

describe("wireSystemSessionUpdatedPublisher", () => {
  it("publishes a UI session.updated event when the runtime pool reports a system session update", () => {
    let capturedHandler: ((params: { sessionKey: string }) => void) | null = null;
    const setSystemSessionUpdatedHandler = vi.fn((handler: (params: { sessionKey: string }) => void) => {
      capturedHandler = handler;
    });
    const runtimePool = {
      setSystemSessionUpdatedHandler
    };
    const publishUiEvent = vi.fn();

    wireSystemSessionUpdatedPublisher({
      runtimePool: runtimePool as { setSystemSessionUpdatedHandler: (handler: (params: { sessionKey: string }) => void) => void },
      publishUiEvent
    });

    expect(setSystemSessionUpdatedHandler).toHaveBeenCalledTimes(1);
    expect(capturedHandler).not.toBeNull();

    const handler = capturedHandler as unknown as (params: { sessionKey: string }) => void;
    handler({ sessionKey: "agent:main:ui:direct:web-ui" });

    expect(publishUiEvent).toHaveBeenCalledWith({
      type: "session.updated",
      payload: {
        sessionKey: "agent:main:ui:direct:web-ui"
      }
    });
  });
});
