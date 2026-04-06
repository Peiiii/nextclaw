import {
  BUILTIN_MAIN_AGENT_ID,
  createAgentProfile,
  loadConfig,
  removeAgentProfile,
  resolveEffectiveAgentProfiles,
  updateAgentProfile,
  type EffectiveAgentProfile
} from "@nextclaw/core";
import type {
  AgentsListCommandOptions,
  AgentsNewCommandOptions,
  AgentsRemoveCommandOptions,
  AgentsUpdateCommandOptions,
  RequestRestartParams
} from "../types.js";

export class AgentCommands {
  constructor(private readonly deps: {
    requestRestart: (params: RequestRestartParams) => Promise<void>;
    initializeAgentHomeDirectory: (homeDirectory: string) => void;
    appName: string;
  }) {}

  agentsList = (opts: AgentsListCommandOptions = {}): void => {
    const config = loadConfig();
    const agents = resolveEffectiveAgentProfiles(config).map((agent) => this.toAgentListEntry(agent));
    if (opts.json) {
      console.log(JSON.stringify(agents, null, 2));
      return;
    }
    for (const agent of agents) {
      const head = agent.builtIn ? `${agent.id} (built-in)` : agent.id;
      console.log(head);
      console.log(`  name: ${agent.displayName ?? "-"}`);
      console.log(`  description: ${agent.description ?? "-"}`);
      console.log(`  home: ${agent.workspace}`);
      console.log(`  avatar: ${agent.avatar ?? "-"}`);
    }
  };

  agentsNew = async (agentId: string, opts: AgentsNewCommandOptions = {}): Promise<void> => {
    const created = createAgentProfile(
      {
        id: agentId,
        displayName: opts.name,
        description: opts.description,
        avatar: opts.avatar,
        home: opts.home
      },
      {
        initializeHomeDirectory: this.deps.initializeAgentHomeDirectory
      }
    );
    if (opts.json) {
      console.log(JSON.stringify({
        agent: created,
        restartRequired: true
      }, null, 2));
      return;
    }
    await this.deps.requestRestart({
      reason: "agents-updated",
      manualMessage: `Created agent '${created.id}'. Restart ${this.deps.appName} to apply agent runtime changes.`
    });
    console.log(`✓ Created agent ${created.id}`);
    console.log(`  name: ${created.displayName ?? "-"}`);
    console.log(`  description: ${created.description ?? "-"}`);
    console.log(`  home: ${created.workspace}`);
    console.log(`  avatar: ${created.avatar ?? "-"}`);
  };

  agentsUpdate = async (agentId: string, opts: AgentsUpdateCommandOptions = {}): Promise<void> => {
    const updated = updateAgentProfile({
      id: agentId,
      displayName: opts.name,
      description: opts.description,
      avatar: opts.avatar
    });
    if (opts.json) {
      console.log(JSON.stringify({
        agent: updated,
        restartRequired: true
      }, null, 2));
      return;
    }
    await this.deps.requestRestart({
      reason: "agents-updated",
      manualMessage: `Updated agent '${updated.id}'. Restart ${this.deps.appName} to apply agent runtime changes.`
    });
    console.log(`✓ Updated agent ${updated.id}`);
    console.log(`  name: ${updated.displayName ?? "-"}`);
    console.log(`  description: ${updated.description ?? "-"}`);
    console.log(`  home: ${updated.workspace}`);
    console.log(`  avatar: ${updated.avatar ?? "-"}`);
  };

  agentsRemove = async (agentId: string, opts: AgentsRemoveCommandOptions = {}): Promise<void> => {
    if (agentId.trim().toLowerCase() === BUILTIN_MAIN_AGENT_ID) {
      throw new Error(`agent id '${BUILTIN_MAIN_AGENT_ID}' is reserved`);
    }
    const removed = removeAgentProfile(agentId);
    if (!removed) {
      throw new Error(`agent '${agentId}' not found`);
    }
    if (opts.json) {
      console.log(JSON.stringify({
        removed: true,
        agentId,
        restartRequired: true
      }, null, 2));
      return;
    }
    await this.deps.requestRestart({
      reason: "agents-updated",
      manualMessage: `Removed agent '${agentId}'. Restart ${this.deps.appName} to apply agent runtime changes.`
    });
    console.log(`✓ Removed agent ${agentId}`);
  };

  private toAgentListEntry = (agent: EffectiveAgentProfile) => {
    return {
      id: agent.id,
      displayName: agent.displayName ?? null,
      description: agent.description ?? null,
      avatar: agent.avatar ?? null,
      workspace: agent.workspace,
      builtIn: agent.builtIn === true
    };
  };
}
