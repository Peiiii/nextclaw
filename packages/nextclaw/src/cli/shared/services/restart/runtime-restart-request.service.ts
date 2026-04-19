import type { RestartResult } from "./restart-coordinator.service.js";
import type { RequestRestartParams } from "@/cli/shared/types/cli.types.js";
import { pendingRestartStore } from "@/cli/shared/stores/pending-restart.store.js";

type RuntimeRestartRequestServiceDeps = {
  armManagedServiceRelaunch: (params: {
    delayMs?: number;
    reason: string;
    strategy?: RequestRestartParams["strategy"];
  }) => void;
  requestRestartFromCoordinator: (params: {
    delayMs?: number;
    manualMessage?: string;
    reason: string;
    strategy?: RequestRestartParams["strategy"];
  }) => Promise<RestartResult>;
};

export class RuntimeRestartRequestService {
  constructor(private readonly deps: RuntimeRestartRequestServiceDeps) {}

  readonly run = async (params: RequestRestartParams): Promise<void> => {
    const {
      changedPaths,
      delayMs,
      manualMessage,
      mode,
      reason,
      silentOnServiceRestart,
      strategy
    } = params;
    if (mode === "notify") {
      pendingRestartStore.mark({
        changedPaths,
        manualMessage,
        reason
      });
      console.warn(manualMessage);
      return;
    }

    this.deps.armManagedServiceRelaunch({
      reason,
      strategy,
      delayMs
    });

    const result = await this.deps.requestRestartFromCoordinator({
      reason,
      strategy,
      delayMs,
      manualMessage
    });
    if (result.status === "manual-required" || result.status === "restart-in-progress") {
      console.log(result.message);
      return;
    }

    pendingRestartStore.clear();
    if (result.status === "service-restarted") {
      if (!silentOnServiceRestart) {
        console.log(result.message);
      }
      return;
    }

    console.warn(result.message);
  };
}
