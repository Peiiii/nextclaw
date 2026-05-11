import { afterEach, describe, expect, it, vi } from "vitest";
import { EventBus } from "@nextclaw/shared";
import type * as NextclawKernelModule from "@nextclaw/kernel";
import type { NextclawGatewayRuntime } from "@nextclaw-service/shared/services/gateway/nextclaw-gateway-runtime.service.js";

let capturedOnSessionUpdated: ((sessionKey: string) => void) | undefined;
const publishSessionChangeMock = vi.fn<(sessionKey: string) => Promise<void>>();

vi.mock("@nextclaw/kernel", async (importOriginal) => {
  const actual = await importOriginal<typeof NextclawKernelModule>();
  return {
    ...actual,
    UiSessionService: class {
      constructor(_sessionManager: unknown, options: { onSessionUpdated?: (sessionKey: string) => void } = {}) {
        capturedOnSessionUpdated = options.onSessionUpdated;
      }
    },
  };
});

vi.mock("@nextclaw-service/shared/services/session/service-deferred-ncp-session-service.js", () => ({
  createDeferredUiNcpSessionService: () => ({
    service: {
      getSession: publishSessionChangeMock,
    },
    clear: vi.fn()
  })
}));

import { ServiceNcpSessionRealtimeBridge } from "../service-ncp-session-realtime-bridge.service.js";

describe("ServiceNcpSessionRealtimeBridge", () => {
  afterEach(() => {
    capturedOnSessionUpdated = undefined;
    publishSessionChangeMock.mockReset();
    vi.restoreAllMocks();
  });

  it("logs fire-and-forget session publish failures instead of surfacing an unhandled rejection", async () => {
    publishSessionChangeMock.mockRejectedValueOnce(new Error("session realtime boom"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    new ServiceNcpSessionRealtimeBridge({
      configManager: {
        loadConfig: () => ({} as never),
      },
      sessionManager: {} as never,
      appEventBus: new EventBus(),
    } as unknown as NextclawGatewayRuntime);

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
