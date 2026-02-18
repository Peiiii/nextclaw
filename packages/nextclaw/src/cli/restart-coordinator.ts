import type { ServiceState } from "./utils.js";

export type RestartStrategy = "background-service-or-manual" | "background-service-or-exit" | "exit-process";

export type RestartRequest = {
  reason: string;
  strategy?: RestartStrategy;
  delayMs?: number;
  manualMessage?: string;
};

export type RestartResult = {
  status: "service-restarted" | "restart-in-progress" | "exit-scheduled" | "manual-required";
  message: string;
};

type RestartCoordinatorDeps = {
  readServiceState: () => ServiceState | null;
  isProcessRunning: (pid: number) => boolean;
  currentPid: () => number;
  restartBackgroundService: (reason: string) => Promise<boolean>;
  scheduleProcessExit: (delayMs: number, reason: string) => void;
};

export class RestartCoordinator {
  private restartingService = false;
  private exitScheduled = false;

  constructor(private deps: RestartCoordinatorDeps) {}

  async requestRestart(request: RestartRequest): Promise<RestartResult> {
    const reason = request.reason.trim() || "config changed";
    const strategy = request.strategy ?? "background-service-or-manual";

    if (strategy !== "exit-process") {
      const state = this.deps.readServiceState();
      const serviceRunning = Boolean(state && this.deps.isProcessRunning(state.pid));
      const managedByCurrentProcess = Boolean(state && state.pid === this.deps.currentPid());

      if (serviceRunning && !managedByCurrentProcess) {
        if (this.restartingService) {
          return {
            status: "restart-in-progress",
            message: "Restart already in progress; skipping duplicate request."
          };
        }
        this.restartingService = true;
        try {
          const restarted = await this.deps.restartBackgroundService(reason);
          if (restarted) {
            return {
              status: "service-restarted",
              message: `Restarted background service to apply changes (${reason}).`
            };
          }
        } finally {
          this.restartingService = false;
        }
      }
    }

    if (strategy === "background-service-or-exit" || strategy === "exit-process") {
      if (this.exitScheduled) {
        return {
          status: "exit-scheduled",
          message: "Restart already scheduled; skipping duplicate request."
        };
      }
      const delay =
        typeof request.delayMs === "number" && Number.isFinite(request.delayMs) ? Math.max(0, Math.floor(request.delayMs)) : 100;
      this.exitScheduled = true;
      this.deps.scheduleProcessExit(delay, reason);
      return {
        status: "exit-scheduled",
        message: `Restart scheduled (${reason}).`
      };
    }

    return {
      status: "manual-required",
      message: request.manualMessage ?? "Restart the gateway to apply changes."
    };
  }
}
