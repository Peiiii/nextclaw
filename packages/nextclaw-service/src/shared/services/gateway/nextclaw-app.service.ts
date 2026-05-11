import type * as NextclawCore from "@nextclaw/core";
import { eventKeys } from "@nextclaw/kernel";
import { resolvePluginChannelMessageToolHints } from "@nextclaw/openclaw-compat";
import { logStartupTrace, measureStartupAsync } from "@nextclaw-service/shared/utils/startup-trace.js";
import {
  UiNcpAgentRuntimeService,
} from "@nextclaw-service/commands/ncp/features/runtime/create-ui-ncp-agent.service.js";
import type { DeferredUiNcpAgentController } from "@nextclaw-service/shared/services/session/service-deferred-ncp-agent.service.js";
import type { NextclawGatewayRuntime } from "@nextclaw-service/shared/services/gateway/nextclaw-gateway-runtime.service.js";

type Config = NextclawCore.Config;

export type UiStartupHandle = {
  deferredNcpAgent: DeferredUiNcpAgentController;
  endpoint: string;
};

type NextclawAppAgentRuntime = Pick<
  UiNcpAgentRuntimeService,
  "bootstrapKernel" | "recoverDurableState" | "warmDerivedCapabilities"
>;

export class NextclawApp {
  private readonly ncpAgentRuntime: NextclawAppAgentRuntime;
  private kernelReady = false;

  constructor(
    private readonly gateway: NextclawGatewayRuntime,
    ncpAgentRuntime?: NextclawAppAgentRuntime,
  ) {
    this.ncpAgentRuntime =
      ncpAgentRuntime ??
      new UiNcpAgentRuntimeService({
        bus: gateway.messageBus,
        providerManager: gateway.providerManager,
        sessionManager: gateway.sessionManager,
        cronService: gateway.automation,
        gatewayController: gateway.gatewayController,
        getConfig: gateway.configManager.loadGatewayConfig,
        getExtensionRegistry: () => gateway.plugins.getExtensionRegistry(),
        onSessionUpdated: gateway.sessions.publishSessionChange,
        onSessionRunStatusChanged: (payload) => {
          gateway.appEventBus.emit(eventKeys.sessionRunStatus, payload, {
            emittedAt: new Date().toISOString(),
            source: "backend",
          });
        },
        onNcpEvent: (event) => {
          gateway.appEventBus.emit(eventKeys.ncpEvent, event, {
            emittedAt: new Date().toISOString(),
            source: "backend",
          });
        },
        resolveMessageToolHints: ({ channel, accountId }) =>
          resolvePluginChannelMessageToolHints({
            registry: gateway.plugins.getRegistry(),
            channel,
            cfg: gateway.configManager.loadGatewayConfig() as Config,
            accountId,
          }),
      });
  }

  start = async (): Promise<void> => {
    logStartupTrace("service.deferred_startup.begin");
    try {
      await this.bootstrapKernel();
      await this.recoverDurableState();
    } catch (error) {
      this.handleKernelStartupError(error);
    }

    await this.warmDerivedCapabilities();
    console.log("✓ Deferred startup: plugin gateways and channels settled");
    logStartupTrace("service.deferred_startup.end");
  };

  bootstrapKernel = async (): Promise<void> => {
    this.gateway.bootstrapStatus.markNcpAgentRunning();
    const ncpAgent = await measureStartupAsync(
      "service.deferred_startup.bootstrap_kernel",
      async () => await this.ncpAgentRuntime.bootstrapKernel(),
    );
    this.gateway.activateNcpAgent(ncpAgent);
    this.kernelReady = true;
    if (this.gateway.configManager.uiConfig.enabled) {
      console.log("✓ UI NCP agent: ready");
      return;
    }
    console.log("✓ Service NCP agent: ready");
  };

  recoverDurableState = async (): Promise<void> => {
    if (!this.kernelReady) {
      return;
    }
    await measureStartupAsync(
      "service.deferred_startup.recover_durable_state",
      async () => await this.ncpAgentRuntime.recoverDurableState(),
    );
  };

  warmDerivedCapabilities = async (): Promise<void> => {
    await measureStartupAsync(
      "service.deferred_startup.load_plugins",
      this.gateway.plugins.load,
    );
    await measureStartupAsync(
      "service.deferred_startup.start_plugin_gateways",
      this.gateway.plugins.startGateways,
    );
    await measureStartupAsync(
      "service.deferred_startup.start_extensions",
      this.gateway.extensions.start,
    );
    await measureStartupAsync("service.deferred_startup.start_channels", this.gateway.gatewayChannels.startDeferred);
    await measureStartupAsync(
      "service.deferred_startup.wake_restart_sentinel",
      this.gateway.restartWake.wakeFromRestartSentinel,
    );
    if (!this.kernelReady) {
      return;
    }
    const timer = setTimeout(() => {
      void measureStartupAsync(
        "service.deferred_startup.warm_ncp_capabilities",
        async () => await this.ncpAgentRuntime.warmDerivedCapabilities(),
      ).catch((error) => {
        console.warn(
          `UI NCP derived capability warmup failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, 0);
    timer.unref?.();
  };

  private readonly handleKernelStartupError = (error: unknown): void => {
    this.gateway.bootstrapStatus.markNcpAgentError(
      error instanceof Error ? error.message : String(error),
    );
    console.error(
      `UI NCP agent startup failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  };
}
