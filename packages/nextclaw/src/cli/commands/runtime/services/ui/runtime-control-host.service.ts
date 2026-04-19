import type { Config } from "@nextclaw/core";
import type { RuntimeControlActionResult, RuntimeControlView, UiRuntimeControlHost } from "@nextclaw/server";
import { requestManagedServiceRestart } from "./service-remote-access.service.js";
import { controlRemoteService, resolveRemoteServiceView } from "../../../remote/services/remote-service-control.service.js";
import type { RequestRestartParams } from "../../../../shared/types/cli.types.js";
import { pendingRestartStore } from "../../../../shared/stores/pending-restart.store.js";

const MANAGED_SERVICE_OWNER_LABEL = "Managed local service";
const DESKTOP_APP_ONLY_REASON = "App restart is only available in the desktop shell.";
const RUNNING_PAGE_START_REASON = "This page is already hosted by the running local service.";

type RuntimeControlHostDeps = {
  serviceCommands: {
    startService: (options: { uiOverrides: Record<string, unknown>; open: boolean }) => Promise<void>;
    stopService: () => Promise<void>;
  };
  requestRestart: (params: RequestRestartParams) => Promise<void>;
  uiConfig: Pick<Config["ui"], "host" | "port">;
};

export class RuntimeControlHost implements UiRuntimeControlHost {
  constructor(private readonly deps: RuntimeControlHostDeps) {}

  getControl = (): RuntimeControlView => {
    const service = resolveRemoteServiceView(this.deps.uiConfig);
    const serviceRunning = service.running;
    const pendingRestart = pendingRestartStore.read();

    return {
      environment: "managed-local-service",
      lifecycle: serviceRunning ? "healthy" : "unavailable",
      serviceState: serviceRunning ? "running" : "stopped",
      canStartService: {
        available: !serviceRunning,
        requiresConfirmation: false,
        impact: "brief-ui-disconnect",
        ...(serviceRunning ? { reasonIfUnavailable: RUNNING_PAGE_START_REASON } : {})
      },
      canRestartService: {
        available: serviceRunning,
        requiresConfirmation: false,
        impact: "brief-ui-disconnect",
        ...(!serviceRunning ? { reasonIfUnavailable: "The local service is not running." } : {})
      },
      canStopService: {
        available: serviceRunning,
        requiresConfirmation: true,
        impact: "brief-ui-disconnect",
        ...(!serviceRunning ? { reasonIfUnavailable: "The local service is already stopped." } : {})
      },
      canRestartApp: {
        available: false,
        requiresConfirmation: true,
        impact: "full-app-relaunch",
        reasonIfUnavailable: DESKTOP_APP_ONLY_REASON
      },
      pendingRestart,
      ownerLabel: MANAGED_SERVICE_OWNER_LABEL,
      managementHint: service.currentProcess
        ? "This page is served by the running local service. Closing the browser does not stop it."
        : "Manage the local NextClaw service from this page without tying service lifecycle to the browser tab.",
      message: "Use this page to manage the local NextClaw service. Closing the browser does not stop the service."
    };
  };

  startService = async (): Promise<RuntimeControlActionResult> => {
    const result = await controlRemoteService("start", this.createServiceControlDeps());
    return {
      accepted: result.accepted,
      action: "start-service",
      lifecycle: "starting-service",
      message: result.message
    };
  };

  restartService = async (): Promise<RuntimeControlActionResult> => {
    const result = await controlRemoteService("restart", this.createServiceControlDeps());
    return {
      accepted: result.accepted,
      action: "restart-service",
      lifecycle: "restarting-service",
      message: result.message
    };
  };

  stopService = async (): Promise<RuntimeControlActionResult> => {
    const result = await controlRemoteService("stop", this.createServiceControlDeps());
    return {
      accepted: result.accepted,
      action: "stop-service",
      lifecycle: "stopping-service",
      message: result.message
    };
  };

  private createServiceControlDeps = () => {
    return {
      serviceCommands: this.deps.serviceCommands,
      requestManagedServiceRestart: () =>
        requestManagedServiceRestart(this.deps.requestRestart, { uiPort: this.deps.uiConfig.port }),
      currentUi: this.deps.uiConfig
    };
  };
}

export function createRuntimeControlHost(params: RuntimeControlHostDeps): RuntimeControlHost {
  return new RuntimeControlHost(params);
}
