import type { AgentId, SkillId, ToolId } from "./entity-ids.types.js";

export type AgentRecord = {
  id: AgentId;
  name: string;
  description?: string;
  enabledSkillIds: SkillId[];
  enabledToolIds: ToolId[];
  metadata: Record<string, unknown>;
};
