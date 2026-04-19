import type { Config } from "@nextclaw/core";
import type { UiCommandOptions } from "@/cli/shared/types/cli.types.js";
import { RuntimeCommandService } from "@/cli/shared/services/runtime-command.service.js";

export class UiCommands {
  constructor(
    private readonly deps: {
      runtimeCommandService: RuntimeCommandService;
      forcedPublicHost: string;
    }
  ) {}

  run = async (opts: UiCommandOptions): Promise<void> => {
    const uiOverrides: Partial<Config["ui"]> = {
      enabled: true,
      host: this.deps.forcedPublicHost,
      open: Boolean(opts.open),
    };
    if (opts.port) {
      uiOverrides.port = Number(opts.port);
    }
    await this.deps.runtimeCommandService.startGateway({
      uiOverrides,
      allowMissingProvider: true,
    });
  };
}
