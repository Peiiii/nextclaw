import type {
  SessionRequestNotifyMode,
  SessionRequestRecord,
  SessionRequestToolResult,
  SessionRequestWaitMode,
} from "./session-request.types.js";
import type {
  CreateSessionContextInheritanceInput as SessionContextInheritanceInput,
} from "@core/features/session/index.js";
import type { NcpRunTriggerInput } from "@nextclaw/shared";

export type SpawnSessionAndRequestParams = {
  sourceSessionId: string;
  sourceToolCallId?: string;
  sourceSessionMetadata: Record<string, unknown>;
  metadataOverrides?: Record<string, unknown>;
  contextInheritance?: SessionContextInheritanceInput;
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
  wait: SessionRequestWaitMode;
  trigger?: NcpRunTriggerInput;
};

export type RequestSessionParams = {
  sourceSessionId: string;
  sourceToolCallId?: string;
  targetSessionId: string;
  task: string;
  title?: string;
  notify: SessionRequestNotifyMode;
  wait: SessionRequestWaitMode;
  handoffDepth?: number;
  trigger?: NcpRunTriggerInput;
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
  wait: SessionRequestWaitMode;
  agentId?: string;
  isChildSession: boolean;
  parentSessionId?: string;
  spawnedByRequestId?: string;
  trigger: NcpRunTriggerInput;
};

export type SessionRequestResultContext = {
  task: string;
  title: string;
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

export type SessionRequestSourceNotifier = (params: {
  request: SessionRequestRecord;
  result: SessionRequestToolResult;
}) => Promise<void>;
