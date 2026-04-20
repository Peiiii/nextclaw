import type { AgentId, LlmProviderId, SkillId, ToolId } from "./entity-ids.types.js";

export type AgentRecord = {
  id: AgentId;
  name: string;
  description?: string;
  defaultProviderId?: LlmProviderId | null;
  enabledSkillIds: SkillId[];
  enabledToolIds: ToolId[];
  metadata: Record<string, unknown>;
};
