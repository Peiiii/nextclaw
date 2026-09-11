import type { NextclawKernel } from "@nextclaw/kernel";
import { logStartupTrace, measureStartupAsync } from "@nextclaw-service/utils/startup-trace.utils.js";
import type { ServiceGatewayManager } from "@nextclaw-service/managers/service-gateway.manager.js";
import { resolveSystemdProcessSupervisor } from "@nextclaw-service/utils/runtime/process-supervisor.utils.js";

export type UiStartupHandle = {
  endpoint: string;
};

type NextclawAppKernel = Pick<
  NextclawKernel,
  "extensions" | "plannedRestartRecovery" | "start"
>;

export class NextclawApp {
  private readonly kernel: NextclawAppKernel;
  private kernelReady = false;

  constructor(private readonly gateway: ServiceGatewayManager) {
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
    this.kernelReady = true;
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
      "service.deferred_startup.recover_planned_restart",
      async () => {
        if (!this.kernelReady) return;
        const operationId = process.env.NEXTCLAW_RESTART_OPERATION_ID?.trim();
        const result = operationId
          ? await this.kernel.plannedRestartRecovery.recover(operationId)
          : resolveSystemdProcessSupervisor(process.env)
            ? await this.kernel.plannedRestartRecovery.recoverFromSupervisor()
            : await this.kernel.plannedRestartRecovery.recover(undefined);
        if (result.status === "recovered") {
          console.log(
            `✓ Planned restart recovery: ${result.resumed} resumed, ${result.skipped} skipped, ${result.failed} failed`,
          );
        }
      },
    );
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
