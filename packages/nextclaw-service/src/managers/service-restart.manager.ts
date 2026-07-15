import { APP_NAME } from "@nextclaw/core";
import { spawn } from "node:child_process";
import type { ManagedServiceManager } from "@nextclaw-service/managers/managed-service.manager.js";
import { NextclawDistributionService } from "@nextclaw-service/services/runtime/nextclaw-distribution.service.js";
import { RestartCoordinator } from "@nextclaw-service/services/restart/restart-coordinator.service.js";
import { managedServiceStateStore } from "@nextclaw-service/stores/managed-service-state.store.js";
import { pendingRestartStore } from "@nextclaw-service/stores/pending-restart.store.js";
import type { RequestRestartParams } from "@nextclaw-service/types/cli.types.js";
import { isProcessRunning } from "@nextclaw-service/utils/cli.utils.js";
import { resolveCliSubcommandLaunch } from "@nextclaw-service/utils/marketplace/cli-subcommand-launch.utils.js";
import { writeRestartSentinel } from "@nextclaw-service/utils/restart-sentinel.utils.js";
import { createTopLevelNextclawCommandEnv } from "@nextclaw-service/utils/top-level-nextclaw-command-env.utils.js";

type ServiceRestartManagerDeps = {
  managedService: ManagedServiceManager;
};

export class ServiceRestartManager {
  private readonly restartCoordinator = new RestartCoordinator({
    readServiceState: managedServiceStateStore.read,
    isProcessRunning,
    currentPid: () => process.pid,
    restartBackgroundService: async (reason) => this.restartBackgroundService(reason),
    scheduleProcessExit: (delayMs, reason) => this.scheduleProcessExit(delayMs, reason),
  });
  private serviceRestartTask: Promise<boolean> | null = null;
  private selfRelaunchArmed = false;

  constructor(private readonly deps: ServiceRestartManagerDeps) {}

  requestRestart = async (params: RequestRestartParams): Promise<void> => {
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

    this.armManagedServiceRelaunch({
      reason,
      strategy,
      delayMs
    });

    const result = await this.restartCoordinator.requestRestart({
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

  restartBackgroundService = async (reason: string): Promise<boolean> => {
    if (this.serviceRestartTask) {
      return this.serviceRestartTask;
    }

    this.serviceRestartTask = (async () => {
      const state = managedServiceStateStore.read();
      if (!state || !isProcessRunning(state.pid) || state.pid === process.pid) {
        return false;
      }

      const uiPort =
        typeof state.uiPort === "number" && Number.isFinite(state.uiPort)
          ? state.uiPort
          : 55667;

      console.log(
        `Applying changes (${reason}): restarting ${APP_NAME} background service...`,
      );
      await this.deps.managedService.stopService();
      await this.deps.managedService.startService({
        uiOverrides: {
          enabled: true,
          host: "0.0.0.0",
          port: uiPort,
        },
        open: false,
      });
      return true;
    })();

    try {
      return await this.serviceRestartTask;
    } finally {
      this.serviceRestartTask = null;
    }
  };

  writeRestartSentinelFromExecContext = async (reason: string): Promise<void> => {
    const sessionKeyRaw = process.env.NEXTCLAW_RUNTIME_SESSION_KEY;
    const sessionKey =
      typeof sessionKeyRaw === "string" ? sessionKeyRaw.trim() : "";
    if (!sessionKey) {
      return;
    }

    try {
      await writeRestartSentinel({
        kind: "restart",
        status: "ok",
        ts: Date.now(),
        sessionKey,
        stats: {
          reason: reason || "cli.restart",
          strategy: "exec-tool",
        },
      });
    } catch (error) {
      console.warn(
        `Warning: failed to write restart sentinel from exec context: ${String(error)}`,
      );
    }
  };

  private scheduleProcessExit = (delayMs: number, reason: string): void => {
    console.warn(`Gateway restart requested (${reason}).`);
    setTimeout(() => {
      process.exit(0);
    }, delayMs);
  };

  private armManagedServiceRelaunch = (params: {
    reason: string;
    strategy?: RequestRestartParams["strategy"];
    delayMs?: number;
  }): void => {
    const { delayMs: requestedDelayMs, reason, strategy = "background-service-or-manual" } = params;
    if (
      strategy !== "background-service-or-exit" &&
      strategy !== "exit-process"
    ) {
      return;
    }
    if (this.selfRelaunchArmed) {
      return;
    }

    const state = managedServiceStateStore.read();
    if (!state || state.pid !== process.pid) {
      return;
    }

    const uiPort =
      typeof state.uiPort === "number" && Number.isFinite(state.uiPort)
        ? state.uiPort
        : 55667;
    const delayMs =
      typeof requestedDelayMs === "number" && Number.isFinite(requestedDelayMs)
        ? Math.max(0, Math.floor(requestedDelayMs))
        : 100;
    const launch = resolveCliSubcommandLaunch({
      argvEntry: NextclawDistributionService.get().launcherEntrypoint,
      importMetaUrl: import.meta.url,
      cliArgs: ["start", "--ui-port", String(uiPort)]
    });
    const serviceStatePath = managedServiceStateStore.path;
    const helperScript = `
const { spawnSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const parentPid = ${process.pid};
const delayMs = ${delayMs};
const maxWaitMs = 120000;
const retryIntervalMs = 1000;
const command = ${JSON.stringify(launch.command)};
const args = ${JSON.stringify(launch.args)};
const serviceStatePath = ${JSON.stringify(serviceStatePath)};
function isRunning(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
function hasReplacementService() {
  try {
    const state = JSON.parse(readFileSync(serviceStatePath, "utf-8"));
    const pid = Number(state?.pid);
    return Number.isFinite(pid) && pid > 0 && pid !== parentPid && isRunning(pid);
  } catch { return false; }
}
function tryStart() {
  spawnSync(command, args, { stdio: "ignore", env: process.env, timeout: 60000, windowsHide: true });
}
setTimeout(() => {
  const startedAt = Date.now();
  const tick = () => {
    if (hasReplacementService() || Date.now() - startedAt >= maxWaitMs) {
      process.exit(0);
      return;
    }
    tryStart();
    if (hasReplacementService()) {
      process.exit(0);
      return;
    }
    setTimeout(tick, retryIntervalMs);
  };
  tick();
}, delayMs);
`.trim();

    try {
      const helper = spawn(process.execPath, ["-e", helperScript], {
        detached: true,
        stdio: "ignore",
        env: createTopLevelNextclawCommandEnv(process.env),
        windowsHide: true
      });
      helper.unref();
      this.selfRelaunchArmed = true;
      console.warn(`Gateway self-restart armed (${reason}).`);
    } catch (error) {
      console.error(`Failed to arm gateway self-restart: ${String(error)}`);
    }
  };
}
