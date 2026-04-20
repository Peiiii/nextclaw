import type { AgentId, SessionId, TaskId } from "./entity-ids.types.js";

export type SessionMessageRole = "system" | "user" | "assistant" | "tool";

export type SessionMessage = {
  role: SessionMessageRole;
  content: unknown;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type SessionRecord = {
  id: SessionId;
  title?: string;
  agentId?: AgentId | null;
  taskIds: TaskId[];
  messages: SessionMessage[];
  contextVersion: number;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};
