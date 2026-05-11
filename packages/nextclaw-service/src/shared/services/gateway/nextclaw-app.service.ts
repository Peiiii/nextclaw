import type { NextclawKernel } from "@nextclaw/kernel";
import { logStartupTrace, measureStartupAsync } from "@nextclaw-service/shared/utils/startup-trace.js";
import type { DeferredUiNcpAgentController } from "@nextclaw-service/shared/services/session/service-deferred-ncp-agent.service.js";
import type { NextclawGatewayRuntime } from "@nextclaw-service/shared/services/gateway/nextclaw-gateway-runtime.service.js";

export type UiStartupHandle = {
  deferredNcpAgent: DeferredUiNcpAgentController;
  endpoint: string;
};

type NextclawAppKernel = Pick<
  NextclawKernel,
  "agentRuntimeManager" | "start"
>;

export class NextclawApp {
  private readonly kernel: NextclawAppKernel;
  private kernelReady = false;

  constructor(
    private readonly gateway: NextclawGatewayRuntime,
    kernel?: NextclawAppKernel,
  ) {
    this.kernel = kernel ?? gateway.kernel;
  }

  start = async (): Promise<void> => {
    logStartupTrace("service.deferred_startup.begin");
    try {
      await this.bootstrapKernel();
    } catch (error) {
      this.handleKernelStartupError(error);
    }

    await this.warmDerivedCapabilities();
    console.log("✓ Deferred startup: plugin gateways and channels settled");
    logStartupTrace("service.deferred_startup.end");
  };

  bootstrapKernel = async (): Promise<void> => {
    this.gateway.bootstrapStatus.markNcpAgentRunning();
    await measureStartupAsync(
      "service.deferred_startup.bootstrap_kernel",
      async () => await this.kernel.start(),
    );
    const ncpAgent = this.kernel.agentRuntimeManager.currentHandle;
    if (!ncpAgent) {
      throw new Error("Kernel start completed without an agent runtime handle.");
    }
    this.gateway.activateAgentRuntime(ncpAgent);
    this.kernelReady = true;
    if (this.gateway.uiConfig.enabled) {
      console.log("✓ UI NCP agent: ready");
      return;
    }
    console.log("✓ Service NCP agent: ready");
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
    await measureStartupAsync("service.deferred_startup.start_channels", this.gateway.startDeferredChannels);
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
        async () => await this.kernel.agentRuntimeManager.warmDerivedCapabilities(),
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
