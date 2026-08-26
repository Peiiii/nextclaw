import { SessionSearchQueryService } from "@core/features/session-search/services/session-search-query.service.js";
import { SessionSearchStore } from "@core/features/session-search/stores/session-search.store.js";
import { SessionSearchFileScannerService } from "@core/features/session-search/worker/session-search-file-scanner.service.js";
import { SessionSearchWorkerIndexerService } from "@core/features/session-search/worker/session-search-worker-indexer.service.js";
import type {
  SessionSearchWorkerEvent,
  SessionSearchWorkerProgress,
  SessionSearchWorkerRequest,
  SessionSearchWorkerStartPayload,
  SessionSearchWorkerState,
} from "@core/features/session-search/worker/session-search-worker-protocol.types.js";

type WorkerRuntime = {
  store: SessionSearchStore;
  queryService: SessionSearchQueryService;
  indexer: SessionSearchWorkerIndexerService;
};

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class SessionSearchWorkerRuntimeService {
  private runtime: WorkerRuntime | null = null;
  private state: SessionSearchWorkerState = "stopped";
  private indexingPromise: Promise<void> | null = null;
  private readonly pendingSessionIds = new Set<string>();

  constructor(private readonly post: (event: SessionSearchWorkerEvent) => void) {}

  handleRequest = async (request: SessionSearchWorkerRequest): Promise<void> => {
    try {
      if (request.type === "start") {
        await this.handleStart(request);
        return;
      }
      if (request.type === "query") {
        await this.handleQuery(request);
        return;
      }
      if (request.type === "session-updated") {
        await this.handleSessionUpdated(request);
        return;
      }
      await this.handleDispose(request);
    } catch (error) {
      this.respondError(request.id, error);
    }
  };

  private setState = (nextState: SessionSearchWorkerState, detail?: string): void => {
    this.state = nextState;
    this.post({ type: "state", state: this.state, ...(detail ? { detail } : {}) });
  };

  private respondOk = (requestId: string, result?: SessionSearchWorkerProgress | null): void => {
    this.post({ type: "response", id: requestId, ok: true, result: result ?? null });
  };

  private respondError = (requestId: string, error: unknown): void => {
    this.post({ type: "response", id: requestId, ok: false, error: formatErrorMessage(error) });
  };

  private requireRuntime = (): WorkerRuntime => {
    if (!this.runtime) {
      throw new Error("Session search worker has not been started.");
    }
    return this.runtime;
  };

  private startRuntime = async (payload: SessionSearchWorkerStartPayload): Promise<void> => {
    if (this.runtime) {
      return;
    }

    this.setState("starting");
    const store = new SessionSearchStore(payload.databasePath);
    await store.initialize();
    const scanner = new SessionSearchFileScannerService(payload.sessionsDir);
    const indexer = new SessionSearchWorkerIndexerService({
      scanner,
      store,
      onProgress: (progress) => this.post({ type: "progress", progress }),
    });
    this.runtime = {
      store,
      indexer,
      queryService: new SessionSearchQueryService(store),
    };
    this.setState("ready");
    this.startIndexing(this.runBackgroundIndexing);
  };

  private runBackgroundIndexing = async (): Promise<void> => {
    await this.requireRuntime().indexer.reconcileAll();
    await this.drainPendingSessionUpdates();
  };

  private runIncrementalIndexing = async (): Promise<void> => {
    await this.drainPendingSessionUpdates();
  };

  private drainPendingSessionUpdates = async (): Promise<void> => {
    const { indexer } = this.requireRuntime();
    while (this.pendingSessionIds.size > 0) {
      const sessionIds = [...this.pendingSessionIds];
      this.pendingSessionIds.clear();
      for (const sessionId of sessionIds) {
        await indexer.indexSession(sessionId);
      }
    }
  };

  private startIndexing = (work: () => Promise<void>): void => {
    if (this.indexingPromise || this.state === "disposed" || this.state === "error") {
      return;
    }
    this.setState("indexing");
    this.indexingPromise = work()
      .then(() => {
        this.setState("idle");
      })
      .catch((error) => {
        this.setState("error", formatErrorMessage(error));
      })
      .finally(() => {
        this.indexingPromise = null;
        if (this.pendingSessionIds.size > 0 && this.state !== "error") {
          this.startIndexing(this.runIncrementalIndexing);
        }
      });
  };

  private handleStart = async (request: Extract<SessionSearchWorkerRequest, { type: "start" }>): Promise<void> => {
    await this.startRuntime(request.payload);
    this.respondOk(request.id);
  };

  private handleQuery = async (request: Extract<SessionSearchWorkerRequest, { type: "query" }>): Promise<void> => {
    const result = await this.requireRuntime().queryService.search(request.payload);
    this.post({ type: "response", id: request.id, ok: true, result });
  };

  private handleSessionUpdated = async (
    request: Extract<SessionSearchWorkerRequest, { type: "session-updated" }>,
  ): Promise<void> => {
    this.requireRuntime();
    this.pendingSessionIds.add(request.payload.sessionId);
    this.startIndexing(this.runIncrementalIndexing);
    this.respondOk(request.id);
  };

  private handleDispose = async (request: Extract<SessionSearchWorkerRequest, { type: "dispose" }>): Promise<void> => {
    await this.indexingPromise?.catch(() => undefined);
    await this.runtime?.store.close();
    this.runtime = null;
    this.indexingPromise = null;
    this.pendingSessionIds.clear();
    this.setState("disposed");
    this.respondOk(request.id);
  };
}
