import type { CreateSessionContextInheritanceInput } from "@nextclaw/core";
import type { NcpMessage, NcpSessionMessagePageInfo } from "@nextclaw/ncp";
import type { ThinkingEffort } from "@kernel/types/agent-run.types.js";

export type SessionMessagePage = {
  messages: NcpMessage[];
  total: number;
  pageInfo: NcpSessionMessagePageInfo;
  contextWindow: Record<string, unknown> | null;
};

export class SessionMessageCursorError extends Error {
  constructor(message = "Invalid session message cursor.") {
    super(message);
    this.name = "SessionMessageCursorError";
  }
}

export function isSessionMessageCursorError(error: unknown): error is SessionMessageCursorError {
  return error instanceof SessionMessageCursorError;
}

export type AgentRunSession = {
  sessionId: string;
  agentId?: string;
  agentRuntimeId: string;
  metadata: Record<string, unknown>;
  model?: string;
  projectRoot?: string;
  workingDir: string;
  thinkingEffort?: ThinkingEffort | null;
};

export type CreateAgentRunSessionParams = {
  sessionId?: string;
  peerId?: string;
  agentId?: string;
  agentRuntimeId?: string;
  channel?: string;
  metadata?: Record<string, unknown>;
  model?: string;
  parentSessionId?: string;
  projectRoot?: string;
  sourceSessionId?: string;
  sourceSessionMetadata?: Record<string, unknown>;
  contextInheritance?: CreateSessionContextInheritanceInput;
  task?: string;
  thinkingEffort?: ThinkingEffort | null;
};

export type SessionSettingsPatch = {
  label?: string | null;
  preferredModel?: string | null;
  preferredThinking?: string | null;
  sessionType?: string | null;
  projectRoot?: string | null;
  uiReadAt?: string | null;
};

export class SessionSettingsError extends Error {
  constructor(
    readonly code: "PREFERRED_THINKING_INVALID",
    message: string
  ) {
    super(message);
    this.name = "SessionSettingsError";
  }
}

export function isSessionSettingsError(error: unknown): error is SessionSettingsError {
  return error instanceof SessionSettingsError;
}
