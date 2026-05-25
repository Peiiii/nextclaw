import type { NextclawKernel } from "@nextclaw/kernel";
import { logStartupTrace, measureStartupAsync } from "@nextclaw-service/shared/utils/startup-trace.js";
import type { NextclawGatewayRuntime } from "@nextclaw-service/shared/services/gateway/nextclaw-gateway-runtime.service.js";

export type UiStartupHandle = {
  endpoint: string;
};

type NextclawAppKernel = Pick<
  NextclawKernel,
  "extensions" | "start"
>;

export class NextclawApp {
  private readonly kernel: NextclawAppKernel;

  constructor(private readonly gateway: NextclawGatewayRuntime) {
    this.kernel = gateway.kernel;
  }

  start = async (): Promise<void> => {
    logStartupTrace("service.deferred_startup.begin");
    try {
      await this.bootstrapKernel();
    } catch (error) {
      this.handleKernelStartupError(error);
    }

    await this.startDeferredRuntimeServices();
    console.log("✓ Deferred startup: extensions and channels settled");
    logStartupTrace("service.deferred_startup.end");
  };

  bootstrapKernel = async (): Promise<void> => {
    this.gateway.bootstrapStatus.markNcpAgentRunning();
    await measureStartupAsync(
      "service.deferred_startup.bootstrap_kernel",
      async () => await this.kernel.start(),
    );
    this.gateway.bootstrapStatus.markNcpAgentReady();
    if (this.gateway.uiConfig.enabled) {
      console.log("✓ UI NCP agent: ready");
      return;
    }
    console.log("✓ Service NCP agent: ready");
  };

  startDeferredRuntimeServices = async (): Promise<void> => {
    await measureStartupAsync(
      "service.deferred_startup.load_extensions",
      this.gateway.extensions.load,
    );
    await measureStartupAsync(
      "service.deferred_startup.start_extensions",
      async () => await this.kernel.extensions.start({ endpoint: this.gateway.uiStartup.endpoint }),
    );
    await measureStartupAsync("service.deferred_startup.start_channels", this.gateway.startDeferredChannels);
    await measureStartupAsync(
      "service.deferred_startup.wake_restart_sentinel",
      this.gateway.restartWake.wakeFromRestartSentinel,
    );
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
