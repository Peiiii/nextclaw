import type { Config } from "@nextclaw/core";
import type {
  RemoteLogger,
  RemoteStatusWriter,
} from "../types/remote.types.js";
import type { RemoteConnector } from "./remote-connector.service.js";

export class RemoteServiceModule {
  private abortController: AbortController | null = null;
  private runTask: Promise<void> | null = null;
  private releaseOwnership: (() => void) | null = null;

  constructor(
    private readonly deps: {
      loadConfig: () => Config;
      uiEnabled: boolean;
      localOrigin: string;
      statusStore: RemoteStatusWriter;
      createConnector: (logger: RemoteLogger) => RemoteConnector;
      claimOwnership?: () => { ok: true; release: () => void } | { ok: false; error: string };
      logger?: RemoteLogger;
    }
  ) {}

  start = (): Promise<void> | null => {
    if (this.runTask) {
      return this.runTask;
    }

    if (!this.deps.uiEnabled) {
      return null;
    }

    const config = this.deps.loadConfig();
    if (!config.remote.enabled) {
      this.deps.statusStore.write({
        enabled: false,
        state: "disabled",
        deviceName: undefined,
        deviceId: undefined,
        platformBase: undefined,
        localOrigin: this.deps.localOrigin,
        lastError: null,
        lastConnectedAt: null
      });
      return null;
    }

    const logger = this.deps.logger ?? {
      info: (message: string) => console.log(`[remote] ${message}`),
      warn: (message: string) => console.warn(`[remote] ${message}`),
      error: (message: string) => console.error(`[remote] ${message}`)
    };

    const ownership = this.deps.claimOwnership?.();
    if (ownership && !ownership.ok) {
      logger.error(ownership.error);
      return null;
    }
    this.releaseOwnership = ownership?.release ?? null;

    this.abortController = new AbortController();
    const connector = this.deps.createConnector(logger);
    this.runTask = connector.run({
      mode: "service",
      signal: this.abortController.signal,
      autoReconnect: config.remote.autoReconnect,
      localOrigin: this.deps.localOrigin,
      statusStore: this.deps.statusStore
    });

    void this.runTask.catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      const latestConfig = this.deps.loadConfig();
      this.deps.statusStore.write({
        enabled: true,
        state: "error",
        deviceName: latestConfig.remote.deviceName || undefined,
        deviceId: undefined,
        platformBase: latestConfig.remote.platformApiBase || undefined,
        localOrigin: this.deps.localOrigin,
        lastError: message
      });
      logger.error(message);
    }).finally(() => {
      this.releaseOwnership?.();
      this.releaseOwnership = null;
    });

    return this.runTask;
  };

  restart = async (): Promise<void> => {
    await this.stop();
    this.start();
  };

  stop = async (): Promise<void> => {
    this.abortController?.abort();
    try {
      await this.runTask;
    } catch {
      // Ignore connector shutdown errors after abort.
    } finally {
      this.abortController = null;
      this.runTask = null;
      this.releaseOwnership?.();
      this.releaseOwnership = null;
    }
  };
}
