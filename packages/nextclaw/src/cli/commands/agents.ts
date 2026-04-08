import {
  BUILTIN_MAIN_AGENT_ID,
  createAgentProfile,
  loadConfig,
  removeAgentProfile,
  resolveEffectiveAgentProfiles,
  updateAgentProfile,
  type EffectiveAgentProfile
} from "@nextclaw/core";
import { listAvailableAgentRuntimes } from "./agent/agent-runtime.js";
import type {
  AgentsListCommandOptions,
  AgentsNewCommandOptions,
  AgentsRemoveCommandOptions,
  AgentsRuntimesCommandOptions,
  AgentsUpdateCommandOptions
} from "../types.js";

export class AgentCommands {
  constructor(private readonly deps: {
    initializeAgentHomeDirectory: (homeDirectory: string) => void;
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
      console.log(`  runtime: ${agent.runtime ?? "-"}`);
    }
  };

  agentsRuntimes = async (opts: AgentsRuntimesCommandOptions = {}): Promise<void> => {
    const describeMode = opts.probe ? "probe" : "observation";
    const listed = await listAvailableAgentRuntimes({ describeMode });
    if (opts.json) {
      console.log(JSON.stringify({
        defaultRuntime: listed.defaultRuntime,
        describeMode,
        runtimes: listed.runtimes,
      }, null, 2));
      return;
    }

    for (const runtime of listed.runtimes) {
      const head = runtime.default ? `${runtime.value} (default)` : runtime.value;
      console.log(head);
      console.log(`  label: ${runtime.label}`);
      console.log(`  source: ${runtime.source}`);
      if (runtime.pluginId) {
        console.log(`  pluginId: ${runtime.pluginId}`);
      }
      console.log(`  ready: ${runtime.ready === false ? "no" : "yes"}`);
      console.log(`  reason: ${runtime.reason ?? "-"}`);
      console.log(`  reasonMessage: ${runtime.reasonMessage ?? "-"}`);
      console.log(`  recommendedModel: ${runtime.recommendedModel ?? "-"}`);
      console.log(`  supportedModels: ${runtime.supportedModels?.join(", ") ?? "-"}`);
    }
  };

  agentsNew = async (agentId: string, opts: AgentsNewCommandOptions = {}): Promise<void> => {
    const created = createAgentProfile(
      {
        id: agentId,
        displayName: opts.name,
        description: opts.description,
        avatar: opts.avatar,
        home: opts.home,
        runtime: opts.runtime
      },
      {
        initializeHomeDirectory: this.deps.initializeAgentHomeDirectory
      }
    );
    if (opts.json) {
      console.log(JSON.stringify({
        agent: created
      }, null, 2));
      return;
    }
    console.log(`✓ Created agent ${created.id}`);
    console.log(`  name: ${created.displayName ?? "-"}`);
    console.log(`  description: ${created.description ?? "-"}`);
    console.log(`  home: ${created.workspace}`);
    console.log(`  avatar: ${created.avatar ?? "-"}`);
    console.log(`  runtime: ${created.runtime ?? created.engine ?? "-"}`);
  };

  agentsUpdate = async (agentId: string, opts: AgentsUpdateCommandOptions = {}): Promise<void> => {
    const updated = updateAgentProfile({
      id: agentId,
      displayName: opts.name,
      description: opts.description,
      avatar: opts.avatar,
      runtime: opts.runtime
    });
    if (opts.json) {
      console.log(JSON.stringify({
        agent: updated
      }, null, 2));
      return;
    }
    console.log(`✓ Updated agent ${updated.id}`);
    console.log(`  name: ${updated.displayName ?? "-"}`);
    console.log(`  description: ${updated.description ?? "-"}`);
    console.log(`  home: ${updated.workspace}`);
    console.log(`  avatar: ${updated.avatar ?? "-"}`);
    console.log(`  runtime: ${updated.runtime ?? updated.engine ?? "-"}`);
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
        agentId
      }, null, 2));
      return;
    }
    console.log(`✓ Removed agent ${agentId}`);
  };

  private toAgentListEntry = (agent: EffectiveAgentProfile) => {
    return {
      id: agent.id,
      displayName: agent.displayName ?? null,
      description: agent.description ?? null,
      avatar: agent.avatar ?? null,
      workspace: agent.workspace,
      runtime: agent.runtime ?? agent.engine ?? null,
      builtIn: agent.builtIn === true
    };
  };
}
