import type { AgentId, SkillId, ToolId } from "@/types/entity-ids.types.js";
import type { AgentRecord } from "@/types/agent.types.js";

export abstract class AgentManager {
  abstract listAgents(): AgentRecord[];
  abstract getAgent(agentId: AgentId): AgentRecord | null;
  abstract requireAgent(agentId: AgentId): AgentRecord;
  abstract saveAgent(agent: AgentRecord): void;
  abstract removeAgent(agentId: AgentId): void;
  abstract attachSkill(agentId: AgentId, skillId: SkillId): void;
  abstract detachSkill(agentId: AgentId, skillId: SkillId): void;
  abstract attachTool(agentId: AgentId, toolId: ToolId): void;
  abstract detachTool(agentId: AgentId, toolId: ToolId): void;
}
