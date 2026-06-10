import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { getConfigPath, loadConfig, saveConfig, type Config } from "@nextclaw/core";
import { APP_NAME } from "@nextclaw/core";
import { localUiDiscoveryService, type LocalUiDiscoveryService } from "@nextclaw-service/services/ui/local-ui-discovery.service.js";
import { isProcessRunning } from "@nextclaw-service/utils/cli.utils.js";
import {
  companionRuntimeStore,
  type CompanionRuntimeState,
  type CompanionRuntimeStore
} from "@nextclaw-service/stores/companion-runtime.store.js";

const require = createRequire(import.meta.url);

class CompanionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanionUnavailableError";
  }
}

function isCompanionUnavailableError(error: unknown): error is CompanionUnavailableError {
  return error instanceof CompanionUnavailableError;
}

export class CompanionRuntimeService {
  constructor(
    private readonly runtimeStore: CompanionRuntimeStore = companionRuntimeStore,
    private readonly uiDiscoveryService: LocalUiDiscoveryService = localUiDiscoveryService
  ) {}

  readonly getRunningState = (): CompanionRuntimeState | null => {
    const state = this.runtimeStore.read();
    if (!state) {
      return null;
    }
    if (!isProcessRunning(state.pid)) {
      this.runtimeStore.clear();
      return null;
    }
    return state;
  };

  readonly resolveDiscoveredBaseUrl = (): string | null => {
    return this.uiDiscoveryService.resolveApiBase();
  };

  readonly isAvailable = (): boolean => {
    try {
      this.resolveLaunchSpec();
      return true;
    } catch (error) {
      if (isCompanionUnavailableError(error)) {
        return false;
      }
      throw error;
    }
  };

  readonly applyConfig = async (config: Config): Promise<void> => {
    if (!config.companion.enabled) {
      await this.ensureStopped();
      return;
    }
    await this.ensureStartedIfAvailable({
      baseUrl: this.uiDiscoveryService.resolveLocalOrigin(config)
    });
  };

  readonly updateEnabled = async (enabled: boolean, options: { baseUrl?: string } = {}): Promise<Config> => {
    const config = loadConfig(getConfigPath());
    const next: Config = {
      ...config,
      companion: {
        ...config.companion,
        enabled
      }
    };
    saveConfig(next, getConfigPath());

    if (enabled) {
      const explicitBaseUrl = options.baseUrl?.trim();
      if (explicitBaseUrl) {
        await this.ensureStartedIfAvailable({ baseUrl: explicitBaseUrl });
        return next;
      }
      const discoveredBaseUrl = this.uiDiscoveryService.resolveApiBase();
      if (discoveredBaseUrl) {
        await this.ensureStartedIfAvailable({ baseUrl: discoveredBaseUrl });
      }
      return next;
    }

    await this.ensureStopped();
    return next;
  };

  readonly ensureStarted = async (options: { baseUrl: string }): Promise<CompanionRuntimeState> => {
    const baseUrl = options.baseUrl.trim().replace(/\/+$/, "");
    const runningState = this.getRunningState();
    if (runningState?.baseUrl === baseUrl) {
      return runningState;
    }
    if (runningState) {
      this.killProcess(runningState.pid, false);
      this.runtimeStore.clear();
    }

    const launchSpec = this.resolveLaunchSpec();
    const child = spawn(launchSpec.command, [...launchSpec.args, "--base-url", baseUrl], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: {
        ...process.env,
        NEXTCLAW_COMPANION_RUNTIME_STATE_PATH: this.runtimeStore.path
      }
    });
    child.unref();

    return await this.waitForRunningState(baseUrl, child.pid ?? -1);
  };

  readonly ensureStopped = async (options: { force?: boolean } = {}): Promise<boolean> => {
    const state = this.runtimeStore.read();
    if (!state) {
      return false;
    }
    if (!isProcessRunning(state.pid)) {
      this.runtimeStore.clear();
      return false;
    }
    this.killProcess(state.pid, options.force === true);
    this.runtimeStore.clear();
    return true;
  };

  readonly printStatus = (options: { json?: boolean } = {}): void => {
    const runningState = this.getRunningState();
    const config = loadConfig(getConfigPath());
    const view = runningState
      ? { configuredEnabled: config.companion.enabled, running: true, ...runningState }
      : { configuredEnabled: config.companion.enabled, running: false };

    if (options.json) {
      console.log(JSON.stringify(view, null, 2));
      return;
    }

    if (!runningState) {
      console.log(
        config.companion.enabled
          ? "Companion is enabled in config but is not running."
          : "Companion is disabled and not running."
      );
      return;
    }

    console.log(
      `Companion is running (pid ${runningState.pid}) at ${runningState.baseUrl}. Configured enabled: ${config.companion.enabled ? "yes" : "no"}.`
    );
  };

  readonly printStarted = (state: CompanionRuntimeState): void => {
    console.log(`Started ${APP_NAME} companion (pid ${state.pid}) using ${state.baseUrl}.`);
  };

  readonly printStopped = (stopped: boolean): void => {
    console.log(stopped ? "Stopped companion process." : "Companion is not running.");
  };

  private readonly killProcess = (pid: number, force: boolean): void => {
    process.kill(pid, force ? "SIGKILL" : "SIGTERM");
  };

  private readonly ensureStartedIfAvailable = async (
    options: { baseUrl: string }
  ): Promise<CompanionRuntimeState | null> => {
    try {
      return await this.ensureStarted(options);
    } catch (error) {
      if (!isCompanionUnavailableError(error)) {
        throw error;
      }
      console.warn(error.message);
      return null;
    }
  };

  private readonly resolveLaunchSpec = (): { command: string; args: string[] } => {
    let packageJsonPath: string;
    try {
      packageJsonPath = require.resolve("@nextclaw/companion/package.json");
    } catch {
      throw new CompanionUnavailableError(
        "@nextclaw/companion is not installed. Install it separately to use the companion shell."
      );
    }
    const packageRoot = dirname(packageJsonPath);
    const mainPath = resolve(packageRoot, "dist", "src", "main.js");
    if (!existsSync(mainPath)) {
      throw new CompanionUnavailableError(
        `Companion app build is missing at ${mainPath}. Install or build @nextclaw/companion separately to use the companion shell.`
      );
    }
    const companionRequire = createRequire(packageJsonPath);
    const electronBinary = companionRequire("electron") as string;
    return {
      command: electronBinary,
      args: [packageRoot]
    };
  };

  private readonly waitForRunningState = async (
    baseUrl: string,
    fallbackPid: number
  ): Promise<CompanionRuntimeState> => {
    const timeoutAt = Date.now() + 5000;
    while (Date.now() < timeoutAt) {
      const state = this.getRunningState();
      if (state?.baseUrl === baseUrl) {
        return state;
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    }

    throw new Error(
      fallbackPid > 0
        ? `Companion started but did not report a live runtime state (launcher pid ${fallbackPid}).`
        : "Companion started but did not report a live runtime state."
    );
  };
}

export const companionRuntimeService = new CompanionRuntimeService();
