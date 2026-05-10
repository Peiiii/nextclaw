import type { AgentId, SessionId, SkillId, TaskId, ToolId } from "./entity-ids.types.js";

export type ContextRecord = {
  sessionId: SessionId;
  taskId?: TaskId | null;
  agentId?: AgentId | null;
  workspace?: string | null;
  memoryRefs: string[];
  selectedSkillIds: SkillId[];
  selectedToolIds: ToolId[];
  variables: Record<string, unknown>;
};
