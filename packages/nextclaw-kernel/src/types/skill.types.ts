import type { SkillId, ToolId } from "./entity-ids.types.js";

export type SkillRecord = {
  id: SkillId;
  name: string;
  description: string;
  toolIds: ToolId[];
  enabled: boolean;
  metadata: Record<string, unknown>;
};
