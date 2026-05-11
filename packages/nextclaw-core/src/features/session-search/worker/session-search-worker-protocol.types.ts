import type {
  SessionSearchRequest,
  SessionSearchResult,
} from "@core/features/session-search/types/session-search.types.js";

export type SessionSearchWorkerState =
  | "stopped"
  | "starting"
  | "ready"
  | "indexing"
  | "idle"
  | "error"
  | "disposed";

export type SessionSearchWorkerStartPayload = {
  sessionsDir: string;
  databasePath: string;
};

export type SessionSearchWorkerRequest =
  | {
      id: string;
      type: "start";
      payload: SessionSearchWorkerStartPayload;
    }
  | {
      id: string;
      type: "query";
      payload: SessionSearchRequest;
    }
  | {
      id: string;
      type: "session-updated";
      payload: {
        sessionId: string;
      };
    }
  | {
      id: string;
      type: "dispose";
    };

export type SessionSearchWorkerProgress = {
  scanned: number;
  indexed: number;
  skipped: number;
  deleted: number;
  total?: number;
};

export type SessionSearchWorkerEvent =
  | {
      type: "state";
      state: SessionSearchWorkerState;
      detail?: string;
    }
  | {
      type: "progress";
      progress: SessionSearchWorkerProgress;
    }
  | {
      type: "response";
      id: string;
      ok: true;
      result?: SessionSearchResult | SessionSearchWorkerProgress | null;
    }
  | {
      type: "response";
      id: string;
      ok: false;
      error: string;
    };
