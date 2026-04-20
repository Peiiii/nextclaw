import { AgentManager } from "@/managers/agent.manager.js";
import { AutomationManager } from "@/managers/automation.manager.js";
import { ChannelManager } from "@/managers/channel.manager.js";
import { ContextBuilder } from "@/managers/context-builder.manager.js";
import { LlmProviderManager } from "@/managers/llm-provider.manager.js";
import { SessionManager } from "@/managers/session.manager.js";
import { SkillManager } from "@/managers/skill.manager.js";
import { TaskManager } from "@/managers/task.manager.js";
import { ToolManager } from "@/managers/tool.manager.js";
import type { NextclawKernelRun, NextclawKernelRunInput } from "@/types/nextclaw-kernel.types.js";

export class NextclawKernel {
  readonly agents = new AgentManager();
  readonly tasks = new TaskManager();
  readonly sessions = new SessionManager();
  readonly contextBuilder = new ContextBuilder(this.sessions);
  readonly tools = new ToolManager();
  readonly skills = new SkillManager();
  readonly llmProviders = new LlmProviderManager();
  readonly automation = new AutomationManager();
  readonly channels = new ChannelManager();

  readonly run = (input: NextclawKernelRunInput): NextclawKernelRun => {
    // TODO(kernel):
    // 1. Accept an event payload expressed as sessionId + messages.
    // 2. Interpret metadata / extra as optional hints, not as hard-coded protocol fields.
    // 3. Resolve or assemble execution context through ContextBuilder when the protocol settles.
    // 4. Resolve internal agent / provider / capability decisions from kernel-owned state.
    // 5. Create the task/session/context side effects behind the owner boundary.
    // 6. Return only a minimal task handle to the caller.
    void input;
    throw new Error("NextclawKernel.run is not implemented.");
  };
}
