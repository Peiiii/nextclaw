import type { DefaultNcpAgentBackend } from "@nextclaw/ncp-toolkit";
import type {
  SessionRequestNotifyMode,
  SessionRequestRecord,
} from "./session-request.types.js";

export type SpawnSessionAndRequestParams = {
  sourceSessionId: string;
  sourceToolCallId?: string;
  sourceSessionMetadata: Record<string, unknown>;
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

export type StreamCompletedMessageParams = {
  backend: DefaultNcpAgentBackend;
  request: SessionRequestRecord;
  task: string;
};

export type PublishRequestOutcomeParams = SessionRequestExecutionParams;
