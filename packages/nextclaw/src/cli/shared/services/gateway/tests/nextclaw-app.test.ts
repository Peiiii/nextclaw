import { describe, expect, it, vi } from "vitest";
import { NextclawApp } from "../nextclaw-app.service.js";

function createAgentHandle() {
  return {
    sessionApi: {},
    agentClientEndpoint: {
      start: async () => undefined,
      stop: async () => undefined,
      send: async () => undefined,
      stream: async () => undefined,
      abort: async () => undefined,
      emit: async () => undefined,
      subscribe: () => () => undefined,
      manifest: {
        endpointKind: "agent",
        endpointId: "test",
        version: "0.0.0",
        supportsStreaming: true,
        supportsAbort: true,
        supportsProactiveMessages: false,
        supportsLiveSessionStream: true,
        supportedPartTypes: ["text"],
        expectedLatency: "seconds",
      },
    },
  };
}

describe("NextclawApp", () => {
  it("marks the NCP agent ready immediately after kernel bootstrap and before capability hydration", async () => {
    const order: string[] = [];
    const ncpAgent = createAgentHandle();
    const app = new NextclawApp({
      bootstrapStatus: {
        markNcpAgentRunning: vi.fn(() => order.push("mark-running")),
        markNcpAgentReady: vi.fn(() => order.push("mark-ready")),
        markNcpAgentError: vi.fn(),
      } as never,
      uiStartup: {
        deferredNcpAgent: {
          activate: vi.fn(() => order.push("activate-ui-agent")),
        },
        publish: vi.fn(),
      } as never,
      deferredNcpSessionService: {
        activate: vi.fn(() => order.push("activate-session-service")),
      } as never,
      bus: {} as never,
      sessionManager: {} as never,
      providerManager: {} as never,
      cronService: {} as never,
      gatewayController: {} as never,
      getConfig: () => ({}) as never,
      getExtensionRegistry: () => undefined,
      resolveMessageToolHints: () => [],
      hydrateCapabilities: vi.fn(async () => {
        order.push("hydrate-capabilities");
      }),
      startPluginGateways: async () => {
        order.push("start-plugin-gateways");
      },
      startChannels: async () => {
        order.push("start-channels");
      },
      wakeFromRestartSentinel: async () => {
        order.push("wake-restart-sentinel");
      },
      onNcpAgentReady: vi.fn(() => order.push("on-ncp-agent-ready")),
      publishSessionChange: vi.fn(),
      ncpAgentRuntime: {
        bootstrapKernel: vi.fn(async () => {
          order.push("bootstrap-kernel");
          return ncpAgent as never;
        }),
        recoverDurableState: vi.fn(async () => {
          order.push("recover-durable-state");
        }),
        warmDerivedCapabilities: vi.fn(async () => {
          order.push("warm-derived-capabilities");
        }),
      },
    });

    await app.start();

    expect(order).toContain("mark-ready");
    expect(order.indexOf("mark-ready")).toBeGreaterThan(order.indexOf("activate-ui-agent"));
    expect(order.indexOf("mark-ready")).toBeLessThan(order.indexOf("hydrate-capabilities"));
    expect(order).toEqual(
      expect.arrayContaining([
        "bootstrap-kernel",
        "recover-durable-state",
        "start-plugin-gateways",
        "start-channels",
        "wake-restart-sentinel",
      ]),
    );
  });

  it("records kernel startup errors but still continues deferred capability work", async () => {
    const hydrateCapabilities = vi.fn(async () => undefined);
    const startPluginGateways = vi.fn(async () => undefined);
    const startChannels = vi.fn(async () => undefined);
    const wakeFromRestartSentinel = vi.fn(async () => undefined);
    const markNcpAgentError = vi.fn();

    const app = new NextclawApp({
      bootstrapStatus: {
        markNcpAgentRunning: vi.fn(),
        markNcpAgentReady: vi.fn(),
        markNcpAgentError,
      } as never,
      uiStartup: null,
      deferredNcpSessionService: {
        activate: vi.fn(),
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
      startPluginGateways,
      startChannels,
      wakeFromRestartSentinel,
      onNcpAgentReady: vi.fn(),
      publishSessionChange: vi.fn(),
      ncpAgentRuntime: {
        bootstrapKernel: vi.fn(async () => {
          throw new Error("kernel failed");
        }),
        recoverDurableState: vi.fn(async () => undefined),
        warmDerivedCapabilities: vi.fn(async () => undefined),
      },
    });

    await app.start();

    expect(markNcpAgentError).toHaveBeenCalledWith("kernel failed");
    expect(hydrateCapabilities).toHaveBeenCalledTimes(1);
    expect(startPluginGateways).toHaveBeenCalledTimes(1);
    expect(startChannels).toHaveBeenCalledTimes(1);
    expect(wakeFromRestartSentinel).toHaveBeenCalledTimes(1);
  });
});
