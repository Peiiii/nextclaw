import type {
  SessionRequestNotifyMode,
  SessionRequestRecord,
  SessionRequestToolResult,
} from "./session-request.types.js";

export type SpawnSessionAndRequestParams = {
  sourceSessionId: string;
  sourceToolCallId?: string;
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

export type SessionRequestExecutionParams = {
  request: SessionRequestRecord;
  task: string;
  title: string;
  agentId?: string;
  isChildSession: boolean;
  parentSessionId?: string;
  spawnedByRequestId?: string;
};

export type SessionRequestTarget = {
  agentId?: string;
  metadata?: Record<string, unknown>;
};

export type SessionRequestDispatchResult = {
  finalResponseMessageId?: string;
  finalResponseText?: string;
};

export type SessionRequestDispatcher = {
  getSession: (sessionId: string) => Promise<SessionRequestTarget | null>;
  dispatch: (params: {
    request: SessionRequestRecord;
    task: string;
    onAccepted: (messageId: string) => void;
  }) => Promise<SessionRequestDispatchResult>;
  publishOutcome: (params: {
    request: SessionRequestRecord;
    result: SessionRequestToolResult;
  }) => Promise<void>;
};

export type PublishRequestOutcomeParams = SessionRequestExecutionParams;
