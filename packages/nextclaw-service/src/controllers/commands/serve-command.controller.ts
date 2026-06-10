import { resolveManagedServiceUiOverrides } from "@nextclaw-service/utils/runtime-helpers.utils.js";
import type { ManagedServiceManager } from "@nextclaw-service/managers/managed-service.manager.js";
import type { StartCommandOptions } from "@nextclaw-service/types/cli.types.js";

export class ServeCommands {
  constructor(
    private readonly deps: {
      runtimeCommandService: ManagedServiceManager;
      forcedPublicHost: string;
    }
  ) {}

  run = async (opts: StartCommandOptions): Promise<void> => {
    const uiOverrides = resolveManagedServiceUiOverrides({
      uiPort: opts.uiPort,
      forcedPublicHost: this.deps.forcedPublicHost
    });

    await this.deps.runtimeCommandService.runForeground({
      uiOverrides,
      open: Boolean(opts.open),
    });
  };
}
