import { AgentManager } from "@/managers/agent.manager.js";
import { AutomationManager } from "@/managers/automation.manager.js";
import { ChannelManager } from "@/managers/channel.manager.js";
import { ContextManager } from "@/managers/context.manager.js";
import { LlmProviderManager } from "@/managers/llm-provider.manager.js";
import { SessionManager } from "@/managers/session.manager.js";
import { SkillManager } from "@/managers/skill.manager.js";
import { TaskManager } from "@/managers/task.manager.js";
import { ToolManager } from "@/managers/tool.manager.js";
import type { SessionMessage } from "@/types/session.types.js";
import type {
  AgentId,
  ChannelId,
  SessionId,
  TaskId,
} from "@/types/entity-ids.types.js";
import type { AutomationRecord } from "@/types/automation.types.js";
import type { NextclawKernelSnapshot } from "@/types/nextclaw-kernel.types.js";

export type NextclawKernelDeps = {
  agents: AgentManager;
  tasks: TaskManager;
  sessions: SessionManager;
  context: ContextManager;
  tools: ToolManager;
  skills: SkillManager;
  llmProviders: LlmProviderManager;
  automation: AutomationManager;
  channels: ChannelManager;
};

export class NextclawKernel {
  readonly agents: AgentManager;
  readonly tasks: TaskManager;
  readonly sessions: SessionManager;
  readonly context: ContextManager;
  readonly tools: ToolManager;
  readonly skills: SkillManager;
  readonly llmProviders: LlmProviderManager;
  readonly automation: AutomationManager;
  readonly channels: ChannelManager;

  constructor(deps: NextclawKernelDeps) {
    this.agents = deps.agents;
    this.tasks = deps.tasks;
    this.sessions = deps.sessions;
    this.context = deps.context;
    this.tools = deps.tools;
    this.skills = deps.skills;
    this.llmProviders = deps.llmProviders;
    this.automation = deps.automation;
    this.channels = deps.channels;
  }

  readonly openSession = (input?: {
    title?: string;
    agentId?: AgentId | null;
    metadata?: Record<string, unknown>;
  }) => {
    const session = this.sessions.createSession(input);
    const agent = session.agentId ? this.agents.getAgent(session.agentId) : null;

    this.context.saveContext({
      sessionId: session.id,
      taskId: null,
      agentId: agent?.id ?? null,
      workspace: null,
      memoryRefs: [],
      selectedSkillIds: agent?.enabledSkillIds ?? [],
      selectedToolIds: agent?.enabledToolIds ?? [],
      selectedProviderId: agent?.defaultProviderId ?? null,
      variables: {},
    });

    return session;
  };

  readonly createTask = (input: {
    title: string;
    sessionId: SessionId;
    agentId: AgentId;
    payload: unknown;
    metadata?: Record<string, unknown>;
  }) => {
    const session = this.sessions.requireSession(input.sessionId);
    const agent = this.agents.requireAgent(input.agentId);

    const task = this.tasks.createTask({
      title: input.title,
      sessionId: session.id,
      agentId: agent.id,
      input: input.payload,
      metadata: input.metadata,
    });

    this.sessions.attachTask(session.id, task.id);

    const assembledContext = this.context.assembleContext({
      session,
      task,
      agent,
    });

    this.context.saveContext(assembledContext);
    return task;
  };

  readonly prepareAgentExecution = (input: {
    sessionId: SessionId;
    taskId: TaskId;
    agentId: AgentId;
  }) => {
    const session = this.sessions.requireSession(input.sessionId);
    const task = this.tasks.requireTask(input.taskId);
    const agent = this.agents.requireAgent(input.agentId);
    const context = this.context.assembleContext({ session, task, agent });

    const resolvedSkills = this.skills.resolveSkills(context.selectedSkillIds);
    const resolvedTools = this.tools.resolveTools(context.selectedToolIds);
    const llmProvider = context.selectedProviderId
      ? this.llmProviders.requireProvider(context.selectedProviderId)
      : this.llmProviders.selectProvider({ agent, context });

    return {
      agent,
      task,
      session,
      context,
      skills: resolvedSkills,
      tools: resolvedTools,
      llmProvider,
    };
  };

  readonly appendSessionMessage = (sessionId: SessionId, message: SessionMessage) => {
    return this.sessions.appendMessage(sessionId, message);
  };

  readonly scheduleAutomation = (automation: AutomationRecord) => {
    this.automation.saveAutomation(automation);
    return automation;
  };

  readonly enableChannel = (channelId: ChannelId) => {
    this.channels.enableChannel(channelId);
    return this.channels.requireChannel(channelId);
  };

  readonly getSnapshot = (): NextclawKernelSnapshot => {
    return {
      agents: this.agents.listAgents(),
      tasks: this.tasks.listTasks(),
      sessions: this.sessions.listSessions(),
      contexts: this.sessions.listSessions().map((session) => this.context.requireContext(session.id)),
      tools: this.tools.listTools(),
      skills: this.skills.listSkills(),
      llmProviders: this.llmProviders.listProviders(),
      automations: this.automation.listAutomations(),
      channels: this.channels.listChannels(),
    };
  };
}
