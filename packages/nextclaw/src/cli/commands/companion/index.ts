import type {
  CompanionDisableCommandOptions,
  CompanionEnableCommandOptions,
  CompanionStartCommandOptions,
  CompanionStatusCommandOptions,
  CompanionStopCommandOptions
} from "@/cli/shared/types/cli.types.js";
import { CompanionProcessService } from "./services/companion-process.service.js";

export class CompanionCommands {
  constructor(private readonly companionProcessService: CompanionProcessService = new CompanionProcessService()) {}

  readonly start = async (options: CompanionStartCommandOptions = {}): Promise<void> => {
    await this.companionProcessService.start(options);
  };

  readonly enable = async (options: CompanionEnableCommandOptions = {}): Promise<void> => {
    await this.companionProcessService.enable(options);
  };

  readonly disable = async (options: CompanionDisableCommandOptions = {}): Promise<void> => {
    await this.companionProcessService.disable(options);
  };

  readonly status = async (options: CompanionStatusCommandOptions = {}): Promise<void> => {
    await this.companionProcessService.status(options);
  };

  readonly stop = async (options: CompanionStopCommandOptions = {}): Promise<void> => {
    await this.companionProcessService.stop(options);
  };
}
