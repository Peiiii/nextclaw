import { resolveManagedServiceUiOverrides } from "@nextclaw-service/shared/utils/runtime-helpers.js";
import type { RuntimeCommandService } from "@nextclaw-service/shared/services/runtime/runtime-command.service.js";
import type { StartCommandOptions } from "@nextclaw-service/shared/types/cli.types.js";

export class ServeCommands {
  constructor(
    private readonly deps: {
      runtimeCommandService: RuntimeCommandService;
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
