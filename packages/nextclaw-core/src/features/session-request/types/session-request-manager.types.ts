import type {
  SessionRequestNotifyMode,
  SessionRequestRecord,
  SessionRequestToolResult,
} from "./session-request.types.js";

export type UpdateSessionRequestToolCallResult = (
  result: SessionRequestToolResult,
) => Promise<void>;

export type SpawnSessionAndRequestParams = {
  sourceSessionId: string;
  sourceToolCallId?: string;
  updateToolCallResult: UpdateSessionRequestToolCallResult;
  sourceSessionMetadata: Record<string, unknown>;
  metadataOverrides?: Record<string, unknown>;
  task: string;
  title?: string;
  model?: string;
  runtime?: string;
  handoffDepth?: number;
  sessionType?: string;
  thinkingLevel?: string;
  projectRoot?: string | null;
  agentId?: string;
  parentSessionId?: string;
  notify: SessionRequestNotifyMode;
};

export type RequestSessionParams = {
  sourceSessionId: string;
  sourceToolCallId?: string;
  updateToolCallResult: UpdateSessionRequestToolCallResult;
  targetSessionId: string;
  task: string;
  title?: string;
  notify: SessionRequestNotifyMode;
  handoffDepth?: number;
};

export type DispatchRequestParams = {
  requestId: string;
  sourceSessionId: string;
  sourceToolCallId?: string;
  updateToolCallResult: UpdateSessionRequestToolCallResult;
  targetSessionId: string;
  task: string;
  title: string;
  handoffDepth: number;
  notify: SessionRequestNotifyMode;
  agentId?: string;
  isChildSession: boolean;
  parentSessionId?: string;
  spawnedByRequestId?: string;
};

export type SessionRequestResultContext = {
  task: string;
  title: string;
  updateToolCallResult: UpdateSessionRequestToolCallResult;
  agentId?: string;
  isChildSession: boolean;
  parentSessionId?: string;
  spawnedByRequestId?: string;
};

export type SessionRequestPayload = {
  request: SessionRequestRecord;
  resultContext: SessionRequestResultContext;
};

export type SessionRequestDispatchResult = {
  finalResponseMessageId?: string;
  finalResponseText?: string;
};

export type SessionRequestDispatcher = {
  dispatch: (params: {
    request: SessionRequestRecord;
    task: string;
    onAccepted: (messageId: string) => void;
  }) => Promise<SessionRequestDispatchResult>;
};
