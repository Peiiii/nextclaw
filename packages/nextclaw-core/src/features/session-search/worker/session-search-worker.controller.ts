import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import type { SessionSearchRequest, SessionSearchResult } from "@core/features/session-search/types/session-search.types.js";
import type {
  SessionSearchWorkerEvent,
  SessionSearchWorkerProgress,
  SessionSearchWorkerRequest,
  SessionSearchWorkerStartPayload,
  SessionSearchWorkerState,
} from "./session-search-worker-protocol.types.js";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type WorkerLike = {
  on(eventName: "message", listener: (event: SessionSearchWorkerEvent) => void): unknown;
  on(eventName: "error", listener: (error: unknown) => void): unknown;
  on(eventName: "exit", listener: (code: number) => void): unknown;
  postMessage(value: SessionSearchWorkerRequest): void;
  terminate(): Promise<unknown>;
};

type SessionSearchWorkerControllerOptions = SessionSearchWorkerStartPayload & {
  createWorker?: () => WorkerLike;
};

function createSessionSearchWorkerEntryUrl(): URL {
  if (import.meta.url.endsWith(".ts")) {
    return new URL("session-search-worker-host.utils.ts", import.meta.url);
  }
  const candidates = [new URL("session-search-worker-host.utils.js", import.meta.url), new URL("features/session-search/worker/session-search-worker-host.utils.js", import.meta.url)];
  return candidates.find((candidate) => existsSync(fileURLToPath(candidate))) ?? (candidates[0] as URL);
}

function createTypeScriptWorkerBootstrapUrl(entryUrl: URL): URL {
  const source = [
    "import { createRequire } from \"node:module\";",
    "import { pathToFileURL } from \"node:url\";",
    `const require = createRequire(${JSON.stringify(entryUrl.href)});`,
    "const { tsImport } = await import(pathToFileURL(require.resolve(\"tsx/esm/api\")).href);",
    `await tsImport(${JSON.stringify(entryUrl.href)}, { parentURL: ${JSON.stringify(entryUrl.href)} });`,
  ].join("\n");
  return new URL(`data:text/javascript,${encodeURIComponent(source)}`);
}

function resolveWorkerExecArgv(): string[] {
  const filtered: string[] = [];
  const skipNextArg = new Set(["-e", "--eval", "-p", "--print"]);
  for (let index = 0; index < process.execArgv.length; index += 1) {
    const arg = process.execArgv[index] ?? "";
    if (skipNextArg.has(arg)) {
      index += 1;
      continue;
    }
    filtered.push(arg);
  }
  return filtered;
}

function defaultCreateWorker(): WorkerLike {
  const entryUrl = createSessionSearchWorkerEntryUrl();
  return new Worker(
    entryUrl.pathname.endsWith(".ts")
      ? createTypeScriptWorkerBootstrapUrl(entryUrl)
      : entryUrl,
    {
      execArgv: resolveWorkerExecArgv(),
    },
  );
}

function createRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export class SessionSearchWorkerController {
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private worker: WorkerLike | null = null;
  private state: SessionSearchWorkerState = "stopped";
  private progress: SessionSearchWorkerProgress | null = null;

  constructor(private readonly options: SessionSearchWorkerControllerOptions) {}

  start = async (): Promise<void> => {
    if (this.worker) {
      return;
    }
    this.state = "starting";
    this.worker = (this.options.createWorker ?? defaultCreateWorker)();
    const worker = this.worker;
    worker.on("message", this.handleMessage);
    worker.on("error", this.handleWorkerError);
    worker.on("exit", this.handleWorkerExit);
    try {
      await this.sendRequest({
        id: createRequestId(),
        type: "start",
        payload: {
          sessionsDir: this.options.sessionsDir,
          databasePath: this.options.databasePath,
        },
      });
    } catch (error) {
      if (this.worker === worker) {
        this.worker = null;
      }
      await worker.terminate().catch(() => undefined);
      this.state = "error";
      throw error;
    }
  };

  query = async (request: SessionSearchRequest): Promise<SessionSearchResult> => {
    const result = await this.sendRequest({
      id: createRequestId(),
      type: "query",
      payload: request,
    });
    return result as SessionSearchResult;
  };

  notifySessionUpdated = (sessionId: string): void => {
    if (!this.worker) {
      return;
    }
    void this.sendRequest({
      id: createRequestId(),
      type: "session-updated",
      payload: { sessionId },
    }).catch((error) => {
      console.warn(`[session-search] Failed to enqueue ${sessionId}: ${error.message}`);
    });
  };

  dispose = async (): Promise<void> => {
    const worker = this.worker;
    if (!worker) {
      return;
    }
    await this.sendRequest({
      id: createRequestId(),
      type: "dispose",
    }).catch(() => undefined);
    this.worker = null;
    await worker.terminate().catch(() => undefined);
    this.state = "disposed";
  };

  getState = (): SessionSearchWorkerState => this.state;

  getProgress = (): SessionSearchWorkerProgress | null => this.progress ? { ...this.progress } : null;

  private sendRequest = async (request: SessionSearchWorkerRequest): Promise<unknown> => {
    const worker = this.worker;
    if (!worker) {
      throw new Error("Session search worker is not running.");
    }
    return await new Promise<unknown>((resolve, reject) => {
      this.pendingRequests.set(request.id, { resolve, reject });
      worker.postMessage(request);
    });
  };

  private handleMessage = (event: SessionSearchWorkerEvent): void => {
    if (event.type === "state") {
      this.state = event.state;
      if (event.detail) {
        console.warn(`[session-search] Worker state ${event.state}: ${event.detail}`);
      }
      return;
    }
    if (event.type === "progress") {
      this.progress = event.progress;
      return;
    }

    const pending = this.pendingRequests.get(event.id);
    if (!pending) {
      return;
    }
    this.pendingRequests.delete(event.id);
    if (event.ok) {
      pending.resolve(event.result ?? null);
    } else {
      pending.reject(new Error(event.error));
    }
  };

  private handleWorkerError = (error: unknown): void => {
    this.rejectAllPending(toError(error));
    this.state = "error";
  };

  private handleWorkerExit = (code: number): void => {
    this.worker = null;
    if (this.state === "disposed") {
      return;
    }
    const error = new Error(`Session search worker exited with code ${code}.`);
    this.rejectAllPending(error);
    this.state = "error";
  };

  private readonly rejectAllPending = (error: Error): void => {
    for (const pending of this.pendingRequests.values()) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  };
}
