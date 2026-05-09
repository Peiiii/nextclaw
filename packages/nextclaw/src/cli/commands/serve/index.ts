import { resolveManagedServiceUiOverrides } from "@nextclaw-service";
import type { RuntimeCommandService } from "@nextclaw-service";
import type { StartCommandOptions } from "@nextclaw-service";

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
