import type { Config } from "@nextclaw/core";
import type { UiCommandOptions } from "@nextclaw-service/types/cli.types.js";
import type { ManagedServiceManager } from "@nextclaw-service/managers/managed-service.manager.js";

export class UiCommands {
  constructor(
    private readonly deps: {
      runtimeCommandService: ManagedServiceManager;
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
    });
  };
}
