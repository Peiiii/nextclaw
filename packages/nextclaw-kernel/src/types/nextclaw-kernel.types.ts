import type { NcpMessage } from "@nextclaw/ncp";
import type { AgentId, SessionId, SkillId, TaskId } from "./entity-ids.types.js";

export type NextclawKernelRunMetadata = {
  agentId?: AgentId;
  model?: string;
  skills?: SkillId[];
};

export type NextclawKernelRunInput = {
  sessionId: SessionId;
  messages: NcpMessage[];
  metadata?: NextclawKernelRunMetadata;
  extra?: Record<string, unknown>;
};

export type NextclawKernelRun = {
  taskId: TaskId;
};
