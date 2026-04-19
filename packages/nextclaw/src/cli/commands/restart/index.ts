import { APP_NAME } from "@nextclaw/core";
import { managedServiceStateStore } from "@/cli/shared/stores/managed-service-state.store.js";
import { isProcessRunning } from "@/cli/shared/utils/cli.utils.js";
import { resolveManagedServiceUiOverrides } from "@/cli/shared/utils/runtime-helpers.js";
import { describeUnmanagedHealthyTargetMessage, RuntimeCommandService } from "@/cli/shared/services/runtime-command.service.js";
import type { StartCommandOptions } from "@/cli/shared/types/cli.types.js";
import { StartCommands } from "@/cli/commands/start/index.js";

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

    const state = managedServiceStateStore.read();
    if (state && isProcessRunning(state.pid)) {
      console.log(`Restarting ${APP_NAME}...`);
      await this.deps.runtimeCommandService.stopService();
    } else {
      if (state) {
        managedServiceStateStore.clear();
        console.log("Service state was stale and has been cleaned up.");
      }

      const unmanagedHealthyServiceMessage = await describeUnmanagedHealthyTargetMessage({ uiOverrides });
      if (unmanagedHealthyServiceMessage) {
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
}
