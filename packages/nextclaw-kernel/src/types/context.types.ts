import type { AgentId, LlmProviderId, SessionId, SkillId, TaskId, ToolId } from "./entity-ids.types.js";

export type ContextRecord = {
  sessionId: SessionId;
  taskId?: TaskId | null;
  agentId?: AgentId | null;
  workspace?: string | null;
  memoryRefs: string[];
  selectedSkillIds: SkillId[];
  selectedToolIds: ToolId[];
  selectedProviderId?: LlmProviderId | null;
  variables: Record<string, unknown>;
};
