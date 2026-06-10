import type { ManagedServiceManager } from "@nextclaw-service/managers/managed-service.manager.js";

export class StopCommands {
  constructor(
    private readonly deps: {
      runtimeCommandService: ManagedServiceManager;
    }
  ) {}

  run = async (): Promise<void> => {
    await this.deps.runtimeCommandService.stopService();
  };
}
