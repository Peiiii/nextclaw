import { APP_NAME, loadConfig } from "@nextclaw/core";
import { managedServiceStateStore } from "@/cli/shared/stores/managed-service-state.store.js";
import { localUiRuntimeStore } from "@/cli/shared/stores/local-ui-runtime.store.js";
import { findListeningProcessByPort, isProcessRunning, resolveUiConfig, waitForExit } from "@/cli/shared/utils/cli.utils.js";
import { resolveManagedServiceUiOverrides } from "@/cli/shared/utils/runtime-helpers.js";
import { describeUnmanagedHealthyTargetMessage, type RuntimeCommandService } from "@/cli/shared/services/runtime/runtime-command.service.js";
import type { StartCommandOptions } from "@/cli/shared/types/cli.types.js";
import type { StartCommands } from "@/cli/commands/start/index.js";

export class RestartCommands {
  constructor(
    private readonly deps: {
      runtimeCommandService: RuntimeCommandService;
      startCommands: StartCommands;
      forcedPublicHost: string;
      writeRestartSentinelFromExecContext: (reason: string) => Promise<void>;
    }
  ) {}

  run = async (opts: StartCommandOptions): Promise<void> => {
    await this.deps.writeRestartSentinelFromExecContext("cli.restart");
    const uiOverrides = resolveManagedServiceUiOverrides({
      uiPort: opts.uiPort,
      forcedPublicHost: this.deps.forcedPublicHost
    });
    const targetUi = resolveUiConfig(loadConfig(), uiOverrides);

    const state = managedServiceStateStore.read();
    if (state && isProcessRunning(state.pid)) {
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
        const restarted = await this.restartForegroundRuntime(foregroundRuntime.pid);
        if (!restarted) {
          return;
        }
        await this.deps.startCommands.run(opts);
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
          const restarted = await this.restartForegroundRuntime(adoptedRuntimePid);
          if (!restarted) {
            return;
          }
          await this.deps.startCommands.run(opts);
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
