import type { AgentRecord } from "@kernel/types/agent.types.js";
import type { AgentId, SkillId, ToolId } from "@kernel/types/entity-ids.types.js";

export class AgentManager {
  listAgents = () => {
    throw new Error("AgentManager.listAgents is not implemented.");
  };

  getAgent = (agentId: AgentId) => {
    void agentId;
    throw new Error("AgentManager.getAgent is not implemented.");
  };

  requireAgent = (agentId: AgentId) => {
    void agentId;
    throw new Error("AgentManager.requireAgent is not implemented.");
  };

  saveAgent = (agent: AgentRecord) => {
    void agent;
    throw new Error("AgentManager.saveAgent is not implemented.");
  };

  removeAgent = (agentId: AgentId) => {
    void agentId;
    throw new Error("AgentManager.removeAgent is not implemented.");
  };

  attachSkill = (agentId: AgentId, skillId: SkillId) => {
    void agentId;
    void skillId;
    throw new Error("AgentManager.attachSkill is not implemented.");
  };

  detachSkill = (agentId: AgentId, skillId: SkillId) => {
    void agentId;
    void skillId;
    throw new Error("AgentManager.detachSkill is not implemented.");
  };

  attachTool = (agentId: AgentId, toolId: ToolId) => {
    void agentId;
    void toolId;
    throw new Error("AgentManager.attachTool is not implemented.");
  };

  detachTool = (agentId: AgentId, toolId: ToolId) => {
    void agentId;
    void toolId;
    throw new Error("AgentManager.detachTool is not implemented.");
  };
}
