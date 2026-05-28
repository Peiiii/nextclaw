import type { ThinkingEffort } from "@kernel/types/agent-run.types.js";

export type AgentRunSession = {
  sessionId: string;
  agentId?: string;
  agentRuntimeId: string;
  metadata: Record<string, unknown>;
  model?: string;
  projectRoot?: string;
  thinkingEffort?: ThinkingEffort | null;
};

export type CreateAgentRunSessionParams = {
  sessionId?: string;
  agentId?: string;
  agentRuntimeId?: string;
  channel?: string;
  metadata?: Record<string, unknown>;
  model?: string;
  projectRoot?: string;
  task?: string;
  thinkingEffort?: ThinkingEffort | null;
};
