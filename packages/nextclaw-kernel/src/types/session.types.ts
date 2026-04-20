import type { NcpMessage } from "@nextclaw/ncp";
import type { AgentId, SessionId, TaskId } from "./entity-ids.types.js";

export type SessionMessage = NcpMessage;

export type SessionRecord = {
  id: SessionId;
  title?: string;
  agentId?: AgentId | null;
  taskIds: TaskId[];
  contextVersion: number;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};
