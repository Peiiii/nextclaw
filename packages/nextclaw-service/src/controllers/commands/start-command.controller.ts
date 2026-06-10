import { parseStartTimeoutMs, resolveManagedServiceUiOverrides } from "@nextclaw-service/utils/runtime-helpers.utils.js";
import type { StartCommandOptions } from "@nextclaw-service/types/cli.types.js";
import type { ManagedServiceManager } from "@nextclaw-service/managers/managed-service.manager.js";

export class StartCommands {
  constructor(
    private readonly deps: {
      runtimeCommandService: ManagedServiceManager;
      forcedPublicHost: string;
      init: (params: { source: string; auto: boolean }) => Promise<void>;
    }
  ) {}

  run = async (opts: StartCommandOptions): Promise<void> => {
    const startupTimeoutMs = parseStartTimeoutMs(opts.startTimeout);
    await this.deps.init({ source: "start", auto: true });
    const uiOverrides = resolveManagedServiceUiOverrides({
      uiPort: opts.uiPort,
      forcedPublicHost: this.deps.forcedPublicHost
    });

    await this.deps.runtimeCommandService.startService({
      uiOverrides,
      open: Boolean(opts.open),
      startupTimeoutMs,
    });
  };
}
