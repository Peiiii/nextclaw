import { describe, expect, it, vi } from "vitest";
import { EventBus } from "@nextclaw/kernel";
import { NextclawApp } from "../nextclaw-app.service.js";
import type { NextclawGatewayRuntime } from "../nextclaw-gateway-runtime.service.js";

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

function createDeferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolvePromise!: () => void;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: resolvePromise,
  };
}

async function waitForScheduledWarmup(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createGateway(params: {
  order?: string[];
  uiEnabled?: boolean;
  loadPlugins?: () => Promise<void>;
  startPluginGateways?: () => Promise<void>;
  startExtensions?: () => Promise<void>;
  startChannels?: () => Promise<void>;
  wakeFromRestartSentinel?: () => Promise<void>;
  markNcpAgentError?: (message: string) => void;
} = {}): NextclawGatewayRuntime {
  const order = params.order ?? [];
  const gateway = {
    appEventBus: new EventBus(),
    bootstrapStatus: {
      markNcpAgentRunning: vi.fn(() => order.push("mark-running")),
      markNcpAgentReady: vi.fn(() => order.push("mark-ready")),
      markNcpAgentError: params.markNcpAgentError ?? vi.fn(),
    },
    configManager: {
      uiConfig: {
        enabled: params.uiEnabled === true,
      },
      loadGatewayConfig: () => ({}),
    },
    uiStartup: {
      deferredNcpAgent: {
        activate: vi.fn(() => order.push("activate-ui-agent")),
      },
    },
    sessions: {
      deferredSessionService: {
        activate: vi.fn(() => order.push("activate-session-service")),
      },
      publishSessionChange: vi.fn(),
    },
    messageBus: {},
    sessionManager: {},
    providerManager: {},
    cron: {},
    gatewayController: {},
    plugins: {
      getExtensionRegistry: () => undefined,
      getRegistry: () => ({ plugins: [] }),
      load: params.loadPlugins ?? vi.fn(async () => undefined),
      startGateways: params.startPluginGateways ?? vi.fn(async () => undefined),
    },
    extensions: {
      start: params.startExtensions ?? vi.fn(async () => undefined),
    },
    gatewayChannels: {
      startDeferred: params.startChannels ?? vi.fn(async () => undefined),
    },
    restartWake: {
      wakeFromRestartSentinel: params.wakeFromRestartSentinel ?? vi.fn(async () => undefined),
    },
    liveUiNcpAgent: null,
  } as unknown as NextclawGatewayRuntime;
  gateway.activateNcpAgent = vi.fn((agent) => {
    gateway.sessions.deferredSessionService.activate(agent.sessionApi);
    gateway.uiStartup.deferredNcpAgent.activate(agent);
    gateway.bootstrapStatus.markNcpAgentReady();
  });
  return gateway;
}

describe("NextclawApp", () => {
  it("marks the NCP agent ready immediately after kernel bootstrap and before plugin loading", async () => {
    const order: string[] = [];
    const ncpAgent = createAgentHandle();
    const gateway = createGateway({
      order,
      uiEnabled: true,
      loadPlugins: vi.fn(async () => {
        order.push("load-plugins");
      }),
      startPluginGateways: vi.fn(async () => {
        order.push("start-plugin-gateways");
      }),
      startChannels: vi.fn(async () => {
        order.push("start-channels");
      }),
      wakeFromRestartSentinel: vi.fn(async () => {
        order.push("wake-restart-sentinel");
      }),
    });
    const app = new NextclawApp(
      gateway,
      {
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
      } as never,
    );

    await app.start();

    expect(order).toContain("mark-ready");
    expect(order.indexOf("mark-ready")).toBeGreaterThan(order.indexOf("activate-ui-agent"));
    expect(order.indexOf("mark-ready")).toBeLessThan(order.indexOf("load-plugins"));
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

  it("does not wait for derived NCP capability warmup before finishing deferred startup", async () => {
    const ncpAgent = createAgentHandle();
    const warmup = createDeferred();
    const startPluginGateways = vi.fn(async () => undefined);
    const startChannels = vi.fn(async () => undefined);
    const wakeFromRestartSentinel = vi.fn(async () => undefined);
    const warmDerivedCapabilities = vi.fn(() => warmup.promise);
    const gateway = createGateway({
      loadPlugins: vi.fn(async () => undefined),
      startPluginGateways,
      startChannels,
      wakeFromRestartSentinel,
    });
    const app = new NextclawApp(
      gateway,
      {
        bootstrapKernel: vi.fn(async () => ncpAgent as never),
        recoverDurableState: vi.fn(async () => undefined),
        warmDerivedCapabilities,
      } as never,
    );

    await expect(app.start()).resolves.toBeUndefined();

    expect(warmDerivedCapabilities).not.toHaveBeenCalled();
    expect(startPluginGateways).toHaveBeenCalledTimes(1);
    expect(startChannels).toHaveBeenCalledTimes(1);
    expect(wakeFromRestartSentinel).toHaveBeenCalledTimes(1);

    await waitForScheduledWarmup();
    expect(warmDerivedCapabilities).toHaveBeenCalledTimes(1);

    warmup.resolve();
  });

  it("records kernel startup errors but still continues deferred plugin work", async () => {
    const loadPlugins = vi.fn(async () => undefined);
    const startPluginGateways = vi.fn(async () => undefined);
    const startChannels = vi.fn(async () => undefined);
    const wakeFromRestartSentinel = vi.fn(async () => undefined);
    const markNcpAgentError = vi.fn();
    const gateway = createGateway({
      loadPlugins,
      startPluginGateways,
      startChannels,
      wakeFromRestartSentinel,
      markNcpAgentError,
    });
    const app = new NextclawApp(
      gateway,
      {
        bootstrapKernel: vi.fn(async () => {
          throw new Error("kernel failed");
        }),
        recoverDurableState: vi.fn(async () => undefined),
        warmDerivedCapabilities: vi.fn(async () => undefined),
      } as never,
    );

    await app.start();

    expect(markNcpAgentError).toHaveBeenCalledWith("kernel failed");
    expect(loadPlugins).toHaveBeenCalledTimes(1);
    expect(startPluginGateways).toHaveBeenCalledTimes(1);
    expect(startChannels).toHaveBeenCalledTimes(1);
    expect(wakeFromRestartSentinel).toHaveBeenCalledTimes(1);
  });
});
