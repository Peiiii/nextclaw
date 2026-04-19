import { RuntimeCommandService } from "@/cli/shared/services/runtime/runtime-command.service.js";

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
