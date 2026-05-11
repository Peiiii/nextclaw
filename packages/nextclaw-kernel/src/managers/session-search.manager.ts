import { SessionSearchWorkerController } from "@nextclaw/core";
import type { NcpTool } from "@nextclaw/ncp";
import { SessionSearchTool } from "@kernel/tools/session-search.tools.js";

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type SessionSearchWorkerControllerLike = Pick<
  SessionSearchWorkerController,
  "start" | "query" | "notifySessionUpdated" | "dispose" | "getState"
>;

export type SessionSearchManagerOptions = {
  databasePath: string;
  onSessionUpdated?: (sessionKey: string) => void;
  sessionsDir: string;
  workerController?: SessionSearchWorkerControllerLike;
};

export class SessionSearchManager {
  private readonly workerController: SessionSearchWorkerControllerLike;
  private enabled = true;
  private ready = false;

  constructor(private readonly options: SessionSearchManagerOptions) {
    this.workerController =
      options.workerController ??
      new SessionSearchWorkerController({
        databasePath: options.databasePath,
        sessionsDir: options.sessionsDir,
      });
  }

  initialize = async (): Promise<void> => {
    try {
      await this.workerController.start();
      this.ready = true;
    } catch (error) {
      this.enabled = false;
      console.warn(`[session-search] Disabled: ${formatErrorMessage(error)}`);
    }
  };

  createTools = (params: { currentSessionId?: string }): NcpTool[] =>
    this.isReady()
      ? [new SessionSearchTool({ search: this.workerController.query }, params)]
      : [];

  handleSessionUpdated = (sessionKey: string): void => {
    this.options.onSessionUpdated?.(sessionKey);
    if (!this.enabled || !this.ready) {
      return;
    }
    this.workerController.notifySessionUpdated(sessionKey);
  };

  dispose = async (): Promise<void> => {
    if (!this.enabled) {
      return;
    }
    await this.workerController.dispose();
  };

  isReady = (): boolean =>
    this.enabled &&
    this.ready &&
    this.workerController.getState() !== "error" &&
    this.workerController.getState() !== "disposed";
}
