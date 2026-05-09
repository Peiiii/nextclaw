import { getSessionsPath, type SessionManager } from "@nextclaw/core";
import type { NcpTool } from "@nextclaw/ncp";
import { SessionSearchTool } from "./session-search-tool.service.js";
import { SessionSearchWorkerController } from "./worker/session-search-worker.controller.js";

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type SessionSearchWorkerControllerLike = Pick<
  SessionSearchWorkerController,
  "start" | "query" | "notifySessionUpdated" | "dispose" | "getState"
>;

export class SessionSearchRuntimeSupport {
  private readonly workerController: SessionSearchWorkerControllerLike;
  private enabled = true;
  private ready = false;

  constructor(
    params: {
      sessionManager: SessionManager;
      onSessionUpdated?: (sessionKey: string) => void;
      databasePath: string;
      sessionsDir?: string;
      workerController?: SessionSearchWorkerControllerLike;
    },
  ) {
    const { databasePath, onSessionUpdated, sessionsDir, workerController } = params;
    this.onSessionUpdated = onSessionUpdated;
    this.workerController =
      workerController ??
      new SessionSearchWorkerController({
        databasePath,
        sessionsDir: sessionsDir ?? getSessionsPath(),
      });
  }

  private readonly onSessionUpdated?: (sessionKey: string) => void;

  initialize = async (): Promise<void> => {
    try {
      await this.workerController.start();
      this.ready = true;
    } catch (error) {
      this.enabled = false;
      console.warn(`[session-search] Disabled: ${formatErrorMessage(error)}`);
    }
  };

  createAdditionalTools = (params: { currentSessionId?: string }): NcpTool[] =>
    this.isReady()
      ? [new SessionSearchTool({ search: this.workerController.query }, params)]
      : [];

  handleSessionUpdated = (sessionKey: string): void => {
    this.onSessionUpdated?.(sessionKey);
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
