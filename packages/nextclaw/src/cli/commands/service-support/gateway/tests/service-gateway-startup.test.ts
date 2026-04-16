import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../ncp/create-ui-ncp-agent.service.js", () => ({
  createUiNcpAgent: vi.fn(),
}));

import { createUiNcpAgent } from "../../../ncp/create-ui-ncp-agent.service.js";
import {
  createSystemSessionUpdatedPublisher,
  startDeferredGatewayStartup,
} from "../service-gateway-startup.js";

afterEach(() => {
  vi.clearAllMocks();
});

describe("createSystemSessionUpdatedPublisher", () => {
  it("publishes a UI session.updated event when the system session reports an update", () => {
    const publishUiEvent = vi.fn();

    const handler = createSystemSessionUpdatedPublisher({
      publishUiEvent
    });

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
