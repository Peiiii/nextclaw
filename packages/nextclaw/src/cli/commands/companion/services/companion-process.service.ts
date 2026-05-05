import { type Config } from "@nextclaw/core";
import type {
  CompanionEnableCommandOptions,
  CompanionDisableCommandOptions,
  CompanionStartCommandOptions,
  CompanionStatusCommandOptions,
  CompanionStopCommandOptions
} from "@/cli/shared/types/cli.types.js";
import {
  companionRuntimeService,
  type CompanionRuntimeService
} from "@/cli/shared/services/ui/companion-runtime.service.js";

export class CompanionProcessService {
  constructor(private readonly runtimeService: CompanionRuntimeService = companionRuntimeService) {}

  readonly start = async (options: CompanionStartCommandOptions = {}): Promise<void> => {
    const state = await this.runtimeService.ensureStarted({
      baseUrl: this.resolveBaseUrl(options)
    });
    this.runtimeService.printStarted(state);
  };

  readonly status = async (options: CompanionStatusCommandOptions = {}): Promise<void> => {
    this.runtimeService.printStatus(options);
  };

  readonly stop = async (options: CompanionStopCommandOptions = {}): Promise<void> => {
    const stopped = await this.runtimeService.ensureStopped(options);
    this.runtimeService.printStopped(stopped);
  };

  readonly enable = async (options: CompanionEnableCommandOptions = {}): Promise<void> => {
    const nextConfig = await this.runtimeService.updateEnabled(true, options);
    this.printConfigEnabled(nextConfig, options.baseUrl);
  };

  readonly disable = async (_options: CompanionDisableCommandOptions = {}): Promise<void> => {
    const nextConfig = await this.runtimeService.updateEnabled(false);
    console.log(
      nextConfig.companion.enabled
        ? "Companion remains enabled."
        : "Companion feature disabled. It will stay off until you enable it again."
    );
  };

  private readonly resolveBaseUrl = (options: CompanionStartCommandOptions): string => {
    const explicitBaseUrl = options.baseUrl?.trim();
    if (explicitBaseUrl) {
      return explicitBaseUrl.replace(/\/+$/, "");
    }
    const discoveredBaseUrl = this.runtimeService.resolveDiscoveredBaseUrl();
    if (discoveredBaseUrl) {
      return discoveredBaseUrl;
    }
    const runningState = this.runtimeService.getRunningState();
    if (runningState) {
      return runningState.baseUrl;
    }
    throw new Error("Cannot resolve NextClaw UI base URL. Start NextClaw first or pass --base-url.");
  };

  private readonly printConfigEnabled = (config: Config, baseUrl?: string): void => {
    if (this.runtimeService.getRunningState()) {
      console.log("Companion feature enabled and companion started.");
      return;
    }
    if (baseUrl?.trim()) {
      console.log("Companion feature enabled.");
      return;
    }
    console.log(
      config.companion.enabled
        ? "Companion feature enabled. It will auto-start the next time a local NextClaw runtime is available."
        : "Companion feature is not enabled."
    );
  };
}
