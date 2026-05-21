import { describe, expect, it, vi } from "vitest";
import { EventBus } from "@nextclaw/shared";
import { NextclawApp } from "../nextclaw-app.service.js";
import type { NextclawGatewayRuntime } from "../nextclaw-gateway-runtime.service.js";
import type { NextclawKernel } from "@nextclaw/kernel";

type TestGatewayKernel = Pick<NextclawKernel, "extensions" | "start">;

function createGateway(params: {
  order?: string[];
  uiEnabled?: boolean;
  kernel: TestGatewayKernel;
  loadPlugins?: () => Promise<void>;
  startPluginGateways?: () => Promise<void>;
  startExtensions?: () => Promise<void>;
  startChannels?: () => Promise<void>;
  wakeFromRestartSentinel?: () => Promise<void>;
  markNcpAgentError?: (message: string) => void;
}): NextclawGatewayRuntime {
  const {
    kernel,
    loadPlugins,
    markNcpAgentError,
    order: inputOrder,
    startChannels,
    startPluginGateways,
    uiEnabled,
    wakeFromRestartSentinel,
  } = params;
  const order = inputOrder ?? [];
  const gateway = {
    appEventBus: new EventBus(),
    bootstrapStatus: {
      markNcpAgentRunning: vi.fn(() => order.push("mark-running")),
      markNcpAgentReady: vi.fn(() => order.push("mark-ready")),
      markNcpAgentError: markNcpAgentError ?? vi.fn(),
    },
    configManager: {
      loadConfig: () => ({}),
    },
    uiConfig: {
      enabled: uiEnabled === true,
    },
    uiStartup: {},
    kernel,
    sessions: {
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
      load: loadPlugins ?? vi.fn(async () => undefined),
      startGateways: startPluginGateways ?? vi.fn(async () => undefined),
    },
    startDeferredChannels: startChannels ?? vi.fn(async () => undefined),
    restartWake: {
      wakeFromRestartSentinel: wakeFromRestartSentinel ?? vi.fn(async () => undefined),
    },
  } as unknown as NextclawGatewayRuntime;
  return gateway;
}

describe("NextclawApp", () => {
  it("marks the NCP agent ready immediately after kernel bootstrap and before plugin loading", async () => {
    const order: string[] = [];
    const gateway = createGateway({
      order,
      uiEnabled: true,
      kernel: {
        start: vi.fn(async () => {
          order.push("bootstrap-kernel");
        }),
        extensions: {
          start: vi.fn(async () => {
            order.push("start-extensions");
          }),
        },
      } as never,
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
    const app = new NextclawApp(gateway);

    await app.start();

    expect(order).toContain("mark-ready");
    expect(order.indexOf("mark-ready")).toBeGreaterThan(order.indexOf("bootstrap-kernel"));
    expect(order.indexOf("mark-ready")).toBeLessThan(order.indexOf("load-plugins"));
    expect(order).toEqual(
      expect.arrayContaining([
        "bootstrap-kernel",
        "start-plugin-gateways",
        "start-channels",
        "wake-restart-sentinel",
      ]),
    );
  });

  it("records kernel startup errors but still continues deferred plugin work", async () => {
    const loadPlugins = vi.fn(async () => undefined);
    const startPluginGateways = vi.fn(async () => undefined);
    const startChannels = vi.fn(async () => undefined);
    const wakeFromRestartSentinel = vi.fn(async () => undefined);
    const markNcpAgentError = vi.fn();
    const gateway = createGateway({
      kernel: {
        start: vi.fn(async () => {
          throw new Error("kernel failed");
        }),
        extensions: {
          start: vi.fn(async () => undefined),
        },
      } as never,
      loadPlugins,
      startPluginGateways,
      startChannels,
      wakeFromRestartSentinel,
      markNcpAgentError,
    });
    const app = new NextclawApp(gateway);

    await app.start();

    expect(markNcpAgentError).toHaveBeenCalledWith("kernel failed");
    expect(loadPlugins).toHaveBeenCalledTimes(1);
    expect(startPluginGateways).toHaveBeenCalledTimes(1);
    expect(startChannels).toHaveBeenCalledTimes(1);
    expect(wakeFromRestartSentinel).toHaveBeenCalledTimes(1);
  });
});
