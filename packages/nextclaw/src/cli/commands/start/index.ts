import { parseStartTimeoutMs, resolveManagedServiceUiOverrides } from "@nextclaw-service";
import type { StartCommandOptions } from "@nextclaw-service";
import type { RuntimeCommandService } from "@nextclaw-service";

export class StartCommands {
  constructor(
    private readonly deps: {
      runtimeCommandService: RuntimeCommandService;
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
