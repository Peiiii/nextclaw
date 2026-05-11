import { parentPort } from "node:worker_threads";
import { SessionSearchFileScannerService } from "./session-search-file-scanner.service.js";
import { SessionSearchQueryService } from "@kernel/agent-runtime/session-search/session-search-query.service.js";
import { SessionSearchStoreService } from "@kernel/agent-runtime/session-search/session-search-store.service.js";
import { SessionSearchWorkerIndexerService } from "./session-search-worker-indexer.service.js";
import type {
  SessionSearchWorkerEvent,
  SessionSearchWorkerProgress,
  SessionSearchWorkerRequest,
  SessionSearchWorkerStartPayload,
  SessionSearchWorkerState,
} from "./session-search-worker-protocol.types.js";

type WorkerRuntime = {
  store: SessionSearchStoreService;
  queryService: SessionSearchQueryService;
  indexer: SessionSearchWorkerIndexerService;
};

let runtime: WorkerRuntime | null = null;
let state: SessionSearchWorkerState = "stopped";
let indexingPromise: Promise<void> | null = null;

function post(event: SessionSearchWorkerEvent): void {
  parentPort?.postMessage(event);
}

function setState(nextState: SessionSearchWorkerState, detail?: string): void {
  state = nextState;
  post({ type: "state", state, ...(detail ? { detail } : {}) });
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function respondOk(requestId: string, result?: SessionSearchWorkerProgress | null): void {
  post({ type: "response", id: requestId, ok: true, result: result ?? null });
}

function respondError(requestId: string, error: unknown): void {
  post({ type: "response", id: requestId, ok: false, error: formatErrorMessage(error) });
}

function requireRuntime(): WorkerRuntime {
  if (!runtime) {
    throw new Error("Session search worker has not been started.");
  }
  return runtime;
}

async function startRuntime(payload: SessionSearchWorkerStartPayload): Promise<void> {
  if (runtime) {
    return;
  }

  setState("starting");
  const store = new SessionSearchStoreService(payload.databasePath);
  await store.initialize();
  const scanner = new SessionSearchFileScannerService(payload.sessionsDir);
  const indexer = new SessionSearchWorkerIndexerService({
    scanner,
    store,
    onProgress: (progress) => post({ type: "progress", progress }),
  });
  runtime = {
    store,
    indexer,
    queryService: new SessionSearchQueryService(store),
  };
  setState("ready");
  indexingPromise = runBackgroundIndexing();
}

async function runBackgroundIndexing(): Promise<void> {
  try {
    setState("indexing");
    await requireRuntime().indexer.reconcileAll();
    setState("idle");
  } catch (error) {
    setState("error", formatErrorMessage(error));
  }
}

async function handleStart(request: Extract<SessionSearchWorkerRequest, { type: "start" }>): Promise<void> {
  await startRuntime(request.payload);
  respondOk(request.id);
}

async function handleQuery(request: Extract<SessionSearchWorkerRequest, { type: "query" }>): Promise<void> {
  const result = await requireRuntime().queryService.search(request.payload);
  post({ type: "response", id: request.id, ok: true, result });
}

async function handleSessionUpdated(
  request: Extract<SessionSearchWorkerRequest, { type: "session-updated" }>,
): Promise<void> {
  const activeRuntime = requireRuntime();
  void activeRuntime.indexer.indexSession(request.payload.sessionId).catch((error) => {
    setState("error", formatErrorMessage(error));
  });
  respondOk(request.id);
}

async function handleDispose(request: Extract<SessionSearchWorkerRequest, { type: "dispose" }>): Promise<void> {
  await indexingPromise?.catch(() => undefined);
  await runtime?.store.close();
  runtime = null;
  indexingPromise = null;
  setState("disposed");
  respondOk(request.id);
}

async function handleRequest(request: SessionSearchWorkerRequest): Promise<void> {
  try {
    if (request.type === "start") {
      await handleStart(request);
      return;
    }
    if (request.type === "query") {
      await handleQuery(request);
      return;
    }
    if (request.type === "session-updated") {
      await handleSessionUpdated(request);
      return;
    }
    await handleDispose(request);
  } catch (error) {
    respondError(request.id, error);
  }
}

parentPort?.on("message", (message: SessionSearchWorkerRequest) => {
  void handleRequest(message);
});
