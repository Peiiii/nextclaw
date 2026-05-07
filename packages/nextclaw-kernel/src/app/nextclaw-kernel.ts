import { AgentManager } from "@kernel/managers/agent.manager.js";
import { AutomationManager } from "@kernel/managers/automation.manager.js";
import { ChannelManager } from "@kernel/managers/channel.manager.js";
import { ContextBuilder } from "@kernel/managers/context-builder.manager.js";
import { LlmProviderManager } from "@kernel/managers/llm-provider.manager.js";
import { SessionManager } from "@kernel/managers/session.manager.js";
import { SkillManager } from "@kernel/managers/skill.manager.js";
import { TaskManager } from "@kernel/managers/task.manager.js";
import { ToolManager } from "@kernel/managers/tool.manager.js";
import type { NextclawKernelRun, NextclawKernelRunInput } from "@kernel/types/nextclaw-kernel.types.js";

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

export class NextclawKernel<
  TGatewayInput = unknown,
  TUiInput = unknown,
  TStartInput = unknown,
> {
  readonly agents = new AgentManager();
  readonly tasks = new TaskManager();
  readonly sessions = new SessionManager();
  readonly contextBuilder = new ContextBuilder(this.sessions);
  readonly control = new NextclawKernelControlManager<
    TGatewayInput,
    TUiInput,
    TStartInput
  >();
  readonly tools = new ToolManager();
  readonly skills = new SkillManager();
  readonly llmProviders = new LlmProviderManager();
  readonly automation = new AutomationManager();
  readonly channels = new ChannelManager();

  readonly run = (input: NextclawKernelRunInput): NextclawKernelRun => {
    void input;
    throw new Error("NextclawKernel.run is not implemented.");
  };
}
