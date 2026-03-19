import type { Config } from "@nextclaw/core";
import { RemoteConnector } from "./remote-connector.js";
import type { RemoteLogger, RemoteStatusWriter } from "./types.js";

export class RemoteServiceModule {
  private abortController: AbortController | null = null;
  private runTask: Promise<void> | null = null;

  constructor(
    private readonly deps: {
      config: Config;
      localOrigin: string;
      statusStore: RemoteStatusWriter;
      createConnector: (logger: RemoteLogger) => RemoteConnector;
      logger?: RemoteLogger;
    }
  ) {}

  start(): Promise<void> | null {
    if (!this.deps.config.remote.enabled) {
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

    this.abortController = new AbortController();
    const connector = this.deps.createConnector(logger);
    this.runTask = connector.run({
      mode: "service",
      signal: this.abortController.signal,
      autoReconnect: this.deps.config.remote.autoReconnect,
      localOrigin: this.deps.localOrigin,
      statusStore: this.deps.statusStore
    });

    void this.runTask.catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.deps.statusStore.write({
        enabled: true,
        state: "error",
        deviceName: this.deps.config.remote.deviceName || undefined,
        deviceId: undefined,
        platformBase: this.deps.config.remote.platformApiBase || undefined,
        localOrigin: this.deps.localOrigin,
        lastError: message
      });
      logger.error(message);
    });

    return this.runTask;
  }

  async stop(): Promise<void> {
    this.abortController?.abort();
    try {
      await this.runTask;
    } catch {
      // Ignore connector shutdown errors after abort.
    } finally {
      this.abortController = null;
      this.runTask = null;
    }
  }
}
