import type { Config } from "@nextclaw/core";
import type { GatewayCommandOptions } from "@/cli/shared/types/cli.types.js";
import { RuntimeCommandService } from "@/cli/shared/services/runtime-command.service.js";

export class GatewayCommands {
  constructor(
    private readonly deps: {
      runtimeCommandService: RuntimeCommandService;
      forcedPublicHost: string;
    }
  ) {}

  run = async (opts: GatewayCommandOptions): Promise<void> => {
    const uiOverrides: Partial<Config["ui"]> = {
      host: this.deps.forcedPublicHost,
    };
    if (opts.ui) {
      uiOverrides.enabled = true;
    }
    if (opts.uiPort) {
      uiOverrides.port = Number(opts.uiPort);
    }
    if (opts.uiOpen) {
      uiOverrides.open = true;
    }
    await this.deps.runtimeCommandService.startGateway({ uiOverrides });
  };
}
