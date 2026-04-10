import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../ncp/create-ui-ncp-agent.js", () => ({
  createUiNcpAgent: vi.fn(),
}));

import { createUiNcpAgent } from "../../../ncp/create-ui-ncp-agent.js";
import {
  startDeferredGatewayStartup,
  wireSystemSessionUpdatedPublisher,
} from "../service-gateway-startup.js";

afterEach(() => {
  vi.clearAllMocks();
});

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

describe("startDeferredGatewayStartup", () => {
  it("starts the NCP agent even when the UI shell is disabled so cron can use the NCP chain", async () => {
    const activateSessionService = vi.fn();
    const onNcpAgentReady = vi.fn();
    const ncpAgent = {
      runApi: { send: vi.fn() },
      sessionApi: {},
    };
    vi.mocked(createUiNcpAgent).mockResolvedValue(ncpAgent as never);
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await startDeferredGatewayStartup({
      uiStartup: null,
      deferredNcpSessionService: {
        activate: activateSessionService,
      } as never,
      bus: {} as never,
      sessionManager: {} as never,
      providerManager: {} as never,
      cronService: {} as never,
      gatewayController: {} as never,
      getConfig: () => ({}) as never,
      getExtensionRegistry: () => undefined,
      resolveMessageToolHints: () => [],
      startPluginGateways: async () => undefined,
      startChannels: async () => undefined,
      wakeFromRestartSentinel: async () => undefined,
      onNcpAgentReady,
      publishSessionChange: vi.fn(),
    });

    expect(createUiNcpAgent).toHaveBeenCalledTimes(1);
    expect(activateSessionService).toHaveBeenCalledWith(ncpAgent.sessionApi);
    expect(onNcpAgentReady).toHaveBeenCalledWith(ncpAgent);
    expect(consoleLog).toHaveBeenCalledWith("✓ Service NCP agent: ready");
    consoleLog.mockRestore();
  });
});
