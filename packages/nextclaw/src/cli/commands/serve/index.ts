import { resolveManagedServiceUiOverrides } from "@/cli/shared/utils/runtime-helpers.js";
import { RuntimeCommandService } from "@/cli/shared/services/runtime-command.service.js";
import type { StartCommandOptions } from "@/cli/shared/types/cli.types.js";

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
