import type { AgentId, SessionId, TaskId } from "./entity-ids.types.js";

export type TaskStatus =
  | "pending"
  | "running"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled";

export type TaskRecord = {
  id: TaskId;
  title: string;
  status: TaskStatus;
  agentId: AgentId;
  sessionId: SessionId;
  input: unknown;
  output?: unknown;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};
