import type { CreateSessionContextInheritanceInput } from "@nextclaw/core";
import type { ThinkingEffort } from "@kernel/types/agent-run.types.js";

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
    message: string,
  ) {
    super(message);
    this.name = "SessionSettingsError";
  }
}

export function isSessionSettingsError(error: unknown): error is SessionSettingsError {
  return error instanceof SessionSettingsError;
}
