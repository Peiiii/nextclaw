import { AgentManager } from "@kernel/managers/agent.manager.js";
import { AutomationManager } from "@kernel/managers/automation.manager.js";
import { ConfigManager } from "@kernel/managers/config.manager.js";
import { LlmProviderManager } from "@kernel/managers/llm-provider.manager.js";
import { SkillManager } from "@kernel/managers/skill.manager.js";
import { ToolManager } from "@kernel/managers/tool.manager.js";
import type { NextclawKernelRun, NextclawKernelRunInput } from "@kernel/types/nextclaw-kernel.types.js";
import { ChannelManager, ensureDir, expandHome, getDataDir, getSessionsPath, MessageBus, SessionManager } from "@nextclaw/core";
import { EventBus, Ingress } from "@nextclaw/shared";
import { resolve } from "node:path";

export type NextclawKernelOptions = {
  homeDir?: string;
  configPath?: string;
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

  installRuntimeControl = (
    runtimeControl: NextclawKernelRuntimeControl<
      TGatewayInput,
      TUiInput,
      TStartInput
    >,
  ) => {
    this.runtimeControl = runtimeControl;
  };

  requireRuntimeControl = () => {
    if (!this.runtimeControl) {
      throw new Error("Kernel runtime control is not installed.");
    }
    return this.runtimeControl;
  };
}

export class NextclawKernel {
  readonly eventBus: EventBus = new EventBus();
  readonly ingress: Ingress = new Ingress();
  readonly messageBus: MessageBus = new MessageBus();
  readonly llmProviders: LlmProviderManager = new LlmProviderManager();
  readonly configManager: ConfigManager;
  readonly agents: AgentManager;
  readonly sessions: SessionManager;
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
    this.sessions = new SessionManager({
      sessionsDir: resolveKernelSessionsDir(options),
    });
    this.automation = new AutomationManager({
      storePath: resolveKernelAutomationStorePath(options),
    });
    this.agents = new AgentManager();
    this.control = new NextclawKernelControlManager<
      unknown,
      unknown,
      unknown
    >();
    this.tools = new ToolManager();
    this.skills = new SkillManager();
    this.channels = new ChannelManager({
      bus: this.messageBus,
      sessionManager: this.sessions,
    });
    this.configManager = new ConfigManager({
      configPath: options.configPath,
      channels: this.channels,
      providerManager: this.llmProviders,
    });
  }

  run = (input: NextclawKernelRunInput): NextclawKernelRun => {
    void input;
    throw new Error("NextclawKernel.run is not implemented.");
  };
}
