import type * as NextclawCore from "@nextclaw/core";
import { logStartupTrace, measureStartupAsync } from "../../../startup-trace.js";
import type { NextclawExtensionRegistry } from "../../plugins.js";
import {
  type CreateUiNcpAgentParams,
  type UiNcpAgentHandle,
  UiNcpAgentRuntimeService,
} from "../../ncp/create-ui-ncp-agent.service.js";
import type { DeferredUiNcpSessionServiceController } from "../session/service-deferred-ncp-session-service.js";
import type { UiStartupHandle } from "./service-gateway-startup.service.js";
import type { ServiceBootstrapStatusStore } from "./service-bootstrap-status.js";

type Config = NextclawCore.Config;
type MessageBus = NextclawCore.MessageBus;
type SessionManager = NextclawCore.SessionManager;
type ProviderManager = NextclawCore.ProviderManager;
type CronService = NextclawCore.CronService;

type NextclawAppAgentRuntime = Pick<
  UiNcpAgentRuntimeService,
  "bootstrapKernel" | "recoverDurableState" | "warmDerivedCapabilities"
>;

export class NextclawApp {
  private readonly ncpAgentRuntime: NextclawAppAgentRuntime;
  private kernelReady = false;

  constructor(
    private readonly params: {
      bootstrapStatus: ServiceBootstrapStatusStore;
      uiStartup: UiStartupHandle | null;
      deferredNcpSessionService: DeferredUiNcpSessionServiceController;
      bus: MessageBus;
      sessionManager: SessionManager;
      providerManager: ProviderManager;
      cronService: CronService;
      gatewayController: NonNullable<CreateUiNcpAgentParams["gatewayController"]>;
      getConfig: () => Config;
      getExtensionRegistry: () => NextclawExtensionRegistry | undefined;
      resolveMessageToolHints: (params: {
        channel: string;
        accountId?: string | null;
      }) => string[];
      hydrateCapabilities?: () => Promise<void>;
      startPluginGateways: () => Promise<void>;
      startChannels: () => Promise<void>;
      wakeFromRestartSentinel: () => Promise<void>;
      onNcpAgentReady: (agent: UiNcpAgentHandle) => void;
      publishSessionChange: (sessionKey: string) => void;
      ncpAgentRuntime?: NextclawAppAgentRuntime;
    },
  ) {
    this.ncpAgentRuntime =
      params.ncpAgentRuntime ??
      new UiNcpAgentRuntimeService({
        bus: params.bus,
        providerManager: params.providerManager,
        sessionManager: params.sessionManager,
        cronService: params.cronService,
        gatewayController: params.gatewayController,
        getConfig: params.getConfig,
        getExtensionRegistry: params.getExtensionRegistry,
        onSessionUpdated: params.publishSessionChange,
        onSessionRunStatusChanged: (payload) => {
          params.uiStartup?.publish({
            type: "session.run-status",
            payload,
          });
        },
        resolveMessageToolHints: ({ channel, accountId }) =>
          params.resolveMessageToolHints({ channel, accountId }),
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
    this.params.bootstrapStatus.markNcpAgentRunning();
    const ncpAgent = await measureStartupAsync(
      "service.deferred_startup.bootstrap_kernel",
      async () => await this.ncpAgentRuntime.bootstrapKernel(),
    );
    this.params.deferredNcpSessionService.activate(ncpAgent.sessionApi);
    this.params.onNcpAgentReady(ncpAgent);
    this.params.uiStartup?.deferredNcpAgent.activate(ncpAgent);
    this.params.bootstrapStatus.markNcpAgentReady();
    this.kernelReady = true;
    if (this.params.uiStartup) {
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
    const runtimeWarmupTask = this.kernelReady
      ? measureStartupAsync(
          "service.deferred_startup.warm_ncp_capabilities",
          async () => await this.ncpAgentRuntime.warmDerivedCapabilities(),
        ).catch((error) => {
          console.warn(
            `UI NCP derived capability warmup failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        })
      : Promise.resolve();

    if (this.params.hydrateCapabilities) {
      await measureStartupAsync(
        "service.deferred_startup.hydrate_capabilities",
        this.params.hydrateCapabilities,
      );
    }
    await measureStartupAsync(
      "service.deferred_startup.start_plugin_gateways",
      this.params.startPluginGateways,
    );
    await measureStartupAsync("service.deferred_startup.start_channels", this.params.startChannels);
    await measureStartupAsync(
      "service.deferred_startup.wake_restart_sentinel",
      this.params.wakeFromRestartSentinel,
    );
    await runtimeWarmupTask;
  };

  private handleKernelStartupError(error: unknown): void {
    this.params.bootstrapStatus.markNcpAgentError(
      error instanceof Error ? error.message : String(error),
    );
    console.error(
      `UI NCP agent startup failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
