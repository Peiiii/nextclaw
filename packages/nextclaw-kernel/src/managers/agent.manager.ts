import type { AgentId, SkillId, ToolId } from "@/types/entity-ids.types.js";
import type { AgentRecord } from "@/types/agent.types.js";

export class AgentManager {
  readonly listAgents = () => {
    throw new Error("AgentManager.listAgents is not implemented.");
  };

  readonly getAgent = (agentId: AgentId) => {
    void agentId;
    throw new Error("AgentManager.getAgent is not implemented.");
  };

  readonly requireAgent = (agentId: AgentId) => {
    void agentId;
    throw new Error("AgentManager.requireAgent is not implemented.");
  };

  readonly saveAgent = (agent: AgentRecord) => {
    void agent;
    throw new Error("AgentManager.saveAgent is not implemented.");
  };

  readonly removeAgent = (agentId: AgentId) => {
    void agentId;
    throw new Error("AgentManager.removeAgent is not implemented.");
  };

  readonly attachSkill = (agentId: AgentId, skillId: SkillId) => {
    void agentId;
    void skillId;
    throw new Error("AgentManager.attachSkill is not implemented.");
  };

  readonly detachSkill = (agentId: AgentId, skillId: SkillId) => {
    void agentId;
    void skillId;
    throw new Error("AgentManager.detachSkill is not implemented.");
  };

  readonly attachTool = (agentId: AgentId, toolId: ToolId) => {
    void agentId;
    void toolId;
    throw new Error("AgentManager.attachTool is not implemented.");
  };

  readonly detachTool = (agentId: AgentId, toolId: ToolId) => {
    void agentId;
    void toolId;
    throw new Error("AgentManager.detachTool is not implemented.");
  };
}
