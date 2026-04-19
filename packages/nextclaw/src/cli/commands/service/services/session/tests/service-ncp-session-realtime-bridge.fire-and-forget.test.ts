import { afterEach, describe, expect, it, vi } from "vitest";

let capturedOnSessionUpdated: ((sessionKey: string) => void) | undefined;
const publishSessionChangeMock = vi.fn<(sessionKey: string) => Promise<void>>();

vi.mock("../../../../ncp/ui-session-service.js", () => ({
  UiSessionService: class {
    constructor(_sessionManager: unknown, options: { onSessionUpdated?: (sessionKey: string) => void } = {}) {
      capturedOnSessionUpdated = options.onSessionUpdated;
    }
  }
}));

vi.mock("../service-deferred-ncp-session-service.js", () => ({
  createDeferredUiNcpSessionService: () => ({
    service: {},
    clear: vi.fn()
  })
}));

vi.mock("../../../../ncp/session/ncp-session-realtime-change.js", () => ({
  createNcpSessionRealtimeChangePublisher: () => ({
    publishSessionChange: publishSessionChangeMock
  })
}));

import { createServiceNcpSessionRealtimeBridge } from "../service-ncp-session-realtime-bridge.js";

describe("createServiceNcpSessionRealtimeBridge", () => {
  afterEach(() => {
    capturedOnSessionUpdated = undefined;
    publishSessionChangeMock.mockReset();
    vi.restoreAllMocks();
  });

  it("logs fire-and-forget session publish failures instead of surfacing an unhandled rejection", async () => {
    publishSessionChangeMock.mockRejectedValueOnce(new Error("session realtime boom"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    createServiceNcpSessionRealtimeBridge({
      sessionManager: {} as never
    });

    expect(capturedOnSessionUpdated).toBeTypeOf("function");

    capturedOnSessionUpdated?.("session-1");

    expect(publishSessionChangeMock).toHaveBeenCalledWith("session-1");
    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[session-realtime] failed to publish session change for session-1:")
      );
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("session realtime boom"));
    });
  });
});
