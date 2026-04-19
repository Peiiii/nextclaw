import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../nextclaw-app.service.js", () => ({
  NextclawApp: vi.fn(),
}));

import { NextclawApp } from "../nextclaw-app.service.js";
import {
  createSystemSessionUpdatedPublisher,
  startDeferredGatewayStartup,
} from "../service-gateway-startup.service.js";

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
  it("delegates deferred startup to NextclawApp even when the UI shell is disabled", async () => {
    const start = vi.fn(async () => undefined);
    const onNcpAgentReady = vi.fn();
    vi.mocked(NextclawApp).mockImplementation(
      function MockNextclawApp() {
        return {
          start,
        } as never;
      } as never,
    );

    await startDeferredGatewayStartup({
      bootstrapStatus: {
      } as never,
      uiStartup: null,
      deferredNcpSessionService: {
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

    expect(NextclawApp).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("passes deferred startup hooks into NextclawApp", async () => {
    const start = vi.fn(async () => undefined);
    vi.mocked(NextclawApp).mockImplementation(
      function MockNextclawApp() {
        return {
          start,
        } as never;
      } as never,
    );
    const hydrateCapabilities = vi.fn(async () => undefined);

    await startDeferredGatewayStartup({
      bootstrapStatus: {
      } as never,
      uiStartup: null,
      deferredNcpSessionService: {
      } as never,
      bus: {} as never,
      sessionManager: {} as never,
      providerManager: {} as never,
      cronService: {} as never,
      gatewayController: {} as never,
      getConfig: () => ({}) as never,
      getExtensionRegistry: () => undefined,
      resolveMessageToolHints: () => [],
      hydrateCapabilities,
      startPluginGateways: async () => undefined,
      startChannels: async () => undefined,
      wakeFromRestartSentinel: async () => undefined,
      onNcpAgentReady: vi.fn(),
      publishSessionChange: vi.fn(),
    });

    expect(NextclawApp).toHaveBeenCalledWith(
      expect.objectContaining({
        hydrateCapabilities,
      }),
    );
    expect(start).toHaveBeenCalledTimes(1);
  });
});
