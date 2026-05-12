import { SessionSearchWorkerController } from "../worker/session-search-worker.controller.js";
import type {
  SessionSearchRequest,
  SessionSearchResult,
} from "../types/session-search.types.js";

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

  start = async (): Promise<void> => {
    try {
      await this.workerController.start();
      this.ready = true;
    } catch (error) {
      this.enabled = false;
      console.warn(`[session-search] Disabled: ${formatErrorMessage(error)}`);
    }
  };

  search = (request: SessionSearchRequest): Promise<SessionSearchResult> =>
    this.workerController.query(request);

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
