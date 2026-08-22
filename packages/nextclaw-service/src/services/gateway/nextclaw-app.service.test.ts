import { describe, expect, it, vi } from "vitest";
import { EventBus } from "@nextclaw/shared";
import { NextclawApp } from "./nextclaw-app.service.js";
import type { ServiceGatewayManager } from "@nextclaw-service/managers/service-gateway.manager.js";
import type { NextclawKernel } from "@nextclaw/kernel";

type TestGatewayKernel = Pick<NextclawKernel, "extensions" | "start">;

function createGateway(params: {
  order?: string[];
  uiEnabled?: boolean;
  kernel: TestGatewayKernel;
  loadExtensions?: () => Promise<void>;
  startExtensions?: () => Promise<void>;
  startChannels?: () => Promise<void>;
  wakeFromRestartSentinel?: () => Promise<void>;
  markNcpAgentError?: (message: string) => void;
}): ServiceGatewayManager {
  const {
    kernel,
    loadExtensions,
    markNcpAgentError,
    order: inputOrder,
    startChannels,
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
    extensions: {
      getExtensionRegistry: () => undefined,
      load: loadExtensions ?? vi.fn(async () => undefined),
    },
    startDeferredChannels: startChannels ?? vi.fn(async () => undefined),
    restartWake: {
      wakeFromRestartSentinel: wakeFromRestartSentinel ?? vi.fn(async () => undefined),
    },
  } as unknown as ServiceGatewayManager;
  return gateway;
}

describe("NextclawApp", () => {
  it("marks the NCP agent ready immediately after kernel bootstrap and before extension loading", async () => {
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
      loadExtensions: vi.fn(async () => {
        order.push("load-extensions");
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
    expect(order.indexOf("mark-ready")).toBeLessThan(order.indexOf("load-extensions"));
    expect(order).toEqual(
      expect.arrayContaining([
        "bootstrap-kernel",
        "start-extensions",
        "start-channels",
        "wake-restart-sentinel",
      ]),
    );
  });

  it("records kernel startup errors but still continues deferred extension work", async () => {
    const loadExtensions = vi.fn(async () => undefined);
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
      loadExtensions,
      startChannels,
      wakeFromRestartSentinel,
      markNcpAgentError,
    });
    const app = new NextclawApp(gateway);

    await app.start();

    expect(markNcpAgentError).toHaveBeenCalledWith("kernel failed");
    expect(loadExtensions).toHaveBeenCalledTimes(1);
    expect(startChannels).toHaveBeenCalledTimes(1);
    expect(wakeFromRestartSentinel).toHaveBeenCalledTimes(1);
  });
});
