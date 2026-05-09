import type { RuntimeCommandService } from "@nextclaw-service";

export class StopCommands {
  constructor(
    private readonly deps: {
      runtimeCommandService: RuntimeCommandService;
    }
  ) {}

  run = async (): Promise<void> => {
    await this.deps.runtimeCommandService.stopService();
  };
}
