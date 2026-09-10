import { APP_NAME, loadConfig } from "@nextclaw/core";
import { managedServiceStateStore } from "@nextclaw-service/stores/managed-service-state.store.js";
import { localUiRuntimeStore } from "@nextclaw-service/stores/local-ui-runtime.store.js";
import { findListeningProcessByPort, isProcessRunning, resolveUiConfig, waitForExit } from "@nextclaw-service/utils/cli.utils.js";
import { resolveManagedServiceUiOverrides } from "@nextclaw-service/utils/runtime-helpers.utils.js";
import { describeUnmanagedHealthyTargetMessage } from "@nextclaw-service/managers/managed-service.manager.js";
import type { ManagedServiceManager } from "@nextclaw-service/managers/managed-service.manager.js";
import type { StartCommandOptions } from "@nextclaw-service/types/cli.types.js";
import type { StartCommands } from "@nextclaw-service/controllers/commands/start-command.controller.js";

export class RestartCommands {
  constructor(
    private readonly deps: {
      runtimeCommandService: ManagedServiceManager;
      startCommands: StartCommands;
      forcedPublicHost: string;
      writeRestartSentinelFromExecContext: (reason: string) => Promise<void>;
    }
  ) {}

  run = async (opts: StartCommandOptions): Promise<void> => {
    if (await this.tryControlledRestart(opts)) return;
    const uiOverrides = resolveManagedServiceUiOverrides({
      uiPort: opts.uiPort,
      forcedPublicHost: this.deps.forcedPublicHost
    });
    const targetUi = resolveUiConfig(loadConfig(), uiOverrides);
    const state = managedServiceStateStore.read();
    if (state && isProcessRunning(state.pid)) {
      await this.deps.writeRestartSentinelFromExecContext("cli.restart");
      console.log(`Restarting ${APP_NAME}...`);
      await this.deps.runtimeCommandService.stopService();
    } else {
      const foregroundRuntime = localUiRuntimeStore.read();
      const foregroundMatchesTarget = Boolean(
        foregroundRuntime &&
        isProcessRunning(foregroundRuntime.pid) &&
        foregroundRuntime.uiPort === targetUi.port
      );
      if (foregroundRuntime && foregroundMatchesTarget) {
        await this.replaceForegroundRuntime(foregroundRuntime.pid, opts);
        return;
      }
      if (state) {
        managedServiceStateStore.clear();
        console.log("Service state was stale and has been cleaned up.");
      }

      const unmanagedHealthyServiceMessage = await describeUnmanagedHealthyTargetMessage({ uiOverrides });
      if (unmanagedHealthyServiceMessage) {
        const adoptedRuntimePid = this.resolveAdoptableForegroundRuntimePid(targetUi.port);
        if (adoptedRuntimePid) {
          await this.replaceForegroundRuntime(adoptedRuntimePid, opts);
          return;
        }
        console.error(`Error: Cannot restart ${APP_NAME} because the target UI/API port is already served by a healthy unmanaged instance.`);
        console.error(unmanagedHealthyServiceMessage);
        return;
      }
      if (!state) {
        console.log("No running service found. Starting a new service.");
      }
    }

    await this.deps.startCommands.run(opts);
  };

  private replaceForegroundRuntime = async (pid: number, opts: StartCommandOptions): Promise<void> => {
    await this.deps.writeRestartSentinelFromExecContext("cli.restart");
    if (await this.restartForegroundRuntime(pid)) await this.deps.startCommands.run(opts);
  };

  private tryControlledRestart = async (opts: StartCommandOptions): Promise<boolean> => {
    if (opts.uiPort !== undefined || opts.open === true || opts.startTimeout !== undefined) return false;
    const managed = managedServiceStateStore.read();
    const foreground = localUiRuntimeStore.read();
    const targetUi = resolveUiConfig(loadConfig(), resolveManagedServiceUiOverrides({
      uiPort: undefined,
      forcedPublicHost: this.deps.forcedPublicHost,
    }));
    const target = managed && isProcessRunning(managed.pid)
      ? managed
      : foreground && foreground.uiPort === targetUi.port && isProcessRunning(foreground.pid)
        ? foreground : null;
    if (!target || !await this.requestRuntimeRestart(target.apiUrl)) return false;
    console.log(`Restarting ${APP_NAME} through the running host...`);
    return true;
  };

  private requestRuntimeRestart = async (apiUrl: string): Promise<boolean> => {
    const response = await fetch(
        `${apiUrl.replace(/\/$/, "")}/runtime/control/restart-service`,
        {
          method: "POST",
          signal: AbortSignal.timeout(30_000),
        },
      );
    if (response.status === 404) return false;
    const result = await response.json() as {
      ok?: boolean;
      data?: { accepted?: boolean };
      error?: { message?: string };
    };
    if (!response.ok || result.ok !== true || result.data?.accepted !== true) {
      throw new Error(result.error?.message ?? "The running host did not accept the restart.");
    }
    return true;
  };

  private restartForegroundRuntime = async (pid: number): Promise<boolean> => {
    console.log(`Restarting ${APP_NAME} foreground runtime (PID ${pid})...`);
    try {
      process.kill(pid, "SIGTERM");
    } catch (error) {
      console.error(`Failed to stop foreground runtime: ${String(error)}`);
      return false;
    }

    const stopped = await waitForExit(pid, 3000);
    if (!stopped) {
      try {
        process.kill(pid, "SIGKILL");
      } catch (error) {
        console.error(`Failed to force stop foreground runtime: ${String(error)}`);
        return false;
      }
      const forcedStopped = await waitForExit(pid, 2000);
      if (!forcedStopped) {
        console.error(`Failed to stop foreground runtime PID ${pid}.`);
        return false;
      }
    }

    localUiRuntimeStore.clearIfOwnedByProcess(pid);
    console.log(`✓ ${APP_NAME} foreground runtime stopped`);
    return true;
  };

  private resolveAdoptableForegroundRuntimePid = (port: number): number | null => {
    const listeningProcess = findListeningProcessByPort(port);
    if (!listeningProcess || !isProcessRunning(listeningProcess.pid)) {
      return null;
    }
    return this.isAdoptableNextclawRuntimeCommand(listeningProcess.command) ? listeningProcess.pid : null;
  };

  private isAdoptableNextclawRuntimeCommand = (command: string | null): boolean => {
    const normalized = command?.trim() ?? "";
    if (!normalized) {
      return false;
    }
    return (
      /\bserve\b/.test(normalized) &&
      (
        normalized.includes("/dist/cli/app/index.js") ||
        normalized.includes("/src/cli/app/index.js") ||
        normalized.includes("/runtime/dist/cli/app/index.js")
      )
    );
  };
}
