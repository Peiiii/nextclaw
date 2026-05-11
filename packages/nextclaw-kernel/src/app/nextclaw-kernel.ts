import { AgentManager } from "@kernel/managers/agent.manager.js";
import { AutomationManager } from "@kernel/managers/automation.manager.js";
import { ChannelManager } from "@kernel/managers/channel.manager.js";
import { ContextBuilder } from "@kernel/managers/context-builder.manager.js";
import { LlmProviderManager } from "@kernel/managers/llm-provider.manager.js";
import { SkillManager } from "@kernel/managers/skill.manager.js";
import { TaskManager } from "@kernel/managers/task.manager.js";
import { ToolManager } from "@kernel/managers/tool.manager.js";
import type { NextclawKernelRun, NextclawKernelRunInput } from "@kernel/types/nextclaw-kernel.types.js";
import { ensureDir, expandHome, getDataDir, getSessionsPath, MessageBus, SessionManager } from "@nextclaw/core";
import { EventBus, Ingress } from "@nextclaw/shared";
import { resolve } from "node:path";

export type NextclawKernelOptions = {
  workspace?: string;
  homeDir?: string;
};

function resolveKernelSessionsDir(options: NextclawKernelOptions): string {
  const homeDir = options.homeDir?.trim();
  if (homeDir) {
    return ensureDir(resolve(expandHome(homeDir), "sessions"));
  }
  return getSessionsPath();
}

function resolveKernelAutomationStorePath(options: NextclawKernelOptions): string {
  const homeDir = options.homeDir?.trim();
  if (homeDir) {
    return resolve(expandHome(homeDir), "cron", "jobs.json");
  }
  return resolve(getDataDir(), "cron", "jobs.json");
}

type NextclawKernelRuntimeControl<
  TGatewayInput,
  TUiInput,
  TStartInput,
> = {
  gateway: (input: TGatewayInput) => Promise<void>;
  ui: (input: TUiInput) => Promise<void>;
  start: (input: TStartInput) => Promise<void>;
  restart: (input: TStartInput) => Promise<void>;
  serve: (input: TStartInput) => Promise<void>;
  stop: () => Promise<void>;
};

class NextclawKernelControlManager<
  TGatewayInput,
  TUiInput,
  TStartInput,
> {
  private runtimeControl: NextclawKernelRuntimeControl<
    TGatewayInput,
    TUiInput,
    TStartInput
  > | null = null;

  readonly installRuntimeControl = (
    runtimeControl: NextclawKernelRuntimeControl<
      TGatewayInput,
      TUiInput,
      TStartInput
    >,
  ) => {
    this.runtimeControl = runtimeControl;
  };

  readonly requireRuntimeControl = () => {
    if (!this.runtimeControl) {
      throw new Error("Kernel runtime control is not installed.");
    }
    return this.runtimeControl;
  };
}

export class NextclawKernel {
  readonly eventBus: EventBus;
  readonly ingress: Ingress;
  readonly messageBus: MessageBus;
  readonly llmProviders: LlmProviderManager;
  readonly agents: AgentManager;
  readonly tasks: TaskManager;
  readonly sessions: SessionManager;
  readonly contextBuilder: ContextBuilder;
  readonly control: NextclawKernelControlManager<
    unknown,
    unknown,
    unknown
  >;
  readonly tools: ToolManager;
  readonly skills: SkillManager;
  readonly automation: AutomationManager;
  readonly channels: ChannelManager;

  constructor(options: NextclawKernelOptions = {}) {
    this.eventBus = new EventBus();
    this.ingress = new Ingress();
    this.messageBus = new MessageBus();
    this.llmProviders = new LlmProviderManager();
    this.sessions = new SessionManager({
      sessionsDir: resolveKernelSessionsDir(options),
    });
    this.automation = new AutomationManager({
      storePath: resolveKernelAutomationStorePath(options),
    });
    this.agents = new AgentManager();
    this.tasks = new TaskManager();
    this.contextBuilder = new ContextBuilder(this.sessions);
    this.control = new NextclawKernelControlManager<
      unknown,
      unknown,
      unknown
    >();
    this.tools = new ToolManager();
    this.skills = new SkillManager();
    this.channels = new ChannelManager();
  }

  readonly run = (input: NextclawKernelRunInput): NextclawKernelRun => {
    void input;
    throw new Error("NextclawKernel.run is not implemented.");
  };
}
