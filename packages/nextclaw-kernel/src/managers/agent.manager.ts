import type { AgentId, SkillId, ToolId } from "@/types/entity-ids.types.js";
import type { AgentRecord } from "@/types/agent.types.js";

export class AgentManager {
  readonly listAgents = () => {
    // TODO(kernel): return the current agent registry snapshot.
    throw new Error("AgentManager.listAgents is not implemented.");
  };

  readonly getAgent = (agentId: AgentId) => {
    // TODO(kernel): look up an agent from the backing store / runtime graph.
    void agentId;
    throw new Error("AgentManager.getAgent is not implemented.");
  };

  readonly requireAgent = (agentId: AgentId) => {
    // TODO(kernel): resolve an agent and throw a domain error when it does not exist.
    void agentId;
    throw new Error("AgentManager.requireAgent is not implemented.");
  };

  readonly saveAgent = (agent: AgentRecord) => {
    // TODO(kernel): persist agent state and publish follow-up lifecycle events if needed.
    void agent;
    throw new Error("AgentManager.saveAgent is not implemented.");
  };

  readonly removeAgent = (agentId: AgentId) => {
    // TODO(kernel): remove an agent and clean up related references.
    void agentId;
    throw new Error("AgentManager.removeAgent is not implemented.");
  };

  readonly attachSkill = (agentId: AgentId, skillId: SkillId) => {
    // TODO(kernel): attach a skill to an agent capability set.
    void agentId;
    void skillId;
    throw new Error("AgentManager.attachSkill is not implemented.");
  };

  readonly detachSkill = (agentId: AgentId, skillId: SkillId) => {
    // TODO(kernel): detach a skill from an agent capability set.
    void agentId;
    void skillId;
    throw new Error("AgentManager.detachSkill is not implemented.");
  };

  readonly attachTool = (agentId: AgentId, toolId: ToolId) => {
    // TODO(kernel): attach a tool to an agent capability set.
    void agentId;
    void toolId;
    throw new Error("AgentManager.attachTool is not implemented.");
  };

  readonly detachTool = (agentId: AgentId, toolId: ToolId) => {
    // TODO(kernel): detach a tool from an agent capability set.
    void agentId;
    void toolId;
    throw new Error("AgentManager.detachTool is not implemented.");
  };
}
