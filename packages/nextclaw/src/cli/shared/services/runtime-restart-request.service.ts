import type { RestartResult } from "./restart-coordinator.service.js";
import type { RequestRestartParams } from "../types/cli.types.js";
import { pendingRestartStore } from "../stores/pending-restart.store.js";

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
    if (params.mode === "notify") {
      pendingRestartStore.mark({
        changedPaths: params.changedPaths,
        manualMessage: params.manualMessage,
        reason: params.reason
      });
      console.warn(params.manualMessage);
      return;
    }

    this.deps.armManagedServiceRelaunch({
      reason: params.reason,
      strategy: params.strategy,
      delayMs: params.delayMs
    });

    const result = await this.deps.requestRestartFromCoordinator({
      reason: params.reason,
      strategy: params.strategy,
      delayMs: params.delayMs,
      manualMessage: params.manualMessage
    });
    if (result.status === "manual-required" || result.status === "restart-in-progress") {
      console.log(result.message);
      return;
    }

    pendingRestartStore.clear();
    if (result.status === "service-restarted") {
      if (!params.silentOnServiceRestart) {
        console.log(result.message);
      }
      return;
    }

    console.warn(result.message);
  };
}
