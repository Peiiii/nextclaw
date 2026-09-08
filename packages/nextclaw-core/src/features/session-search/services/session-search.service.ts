import { SessionSearchWorkerController } from "@core/features/session-search/worker/session-search-worker.controller.js";
import type {
  SessionSearchRequest,
  SessionSearchResult,
} from "@core/features/session-search/types/session-search.types.js";

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type SessionSearchWorkerControllerLike = Pick<
  SessionSearchWorkerController,
  "start" | "query" | "notifySessionUpdated" | "dispose" | "getState"
>;

export type SessionSearchServiceOptions = {
  databasePath: string;
  sessionsDir: string;
  workerController?: SessionSearchWorkerControllerLike;
};

export class SessionSearchService {
  private readonly workerController: SessionSearchWorkerControllerLike;
  private enabled = true;
  private ready = false;

  constructor(private readonly options: SessionSearchServiceOptions) {
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

  search = async (request: SessionSearchRequest): Promise<SessionSearchResult> => {
    if (!this.isReady()) {
      const state = this.workerController.getState();
      throw new Error(state === "starting"
        ? "SESSION_SEARCH_NOT_READY: the index is initializing in the background; no search was performed."
        : `SESSION_SEARCH_UNAVAILABLE: index state is ${state}; no search was performed.`);
    }
    return this.workerController.query(request);
  };

  handleSessionUpdated = (sessionKey: string): void => {
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
