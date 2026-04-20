import type { AgentRecord } from "./agent.types.js";
import type { AutomationRecord } from "./automation.types.js";
import type { ChannelRecord } from "./channel.types.js";
import type { ContextRecord } from "./context.types.js";
import type { LlmProviderRecord } from "./llm-provider.types.js";
import type { SessionRecord } from "./session.types.js";
import type { SkillRecord } from "./skill.types.js";
import type { TaskRecord } from "./task.types.js";
import type { ToolRecord } from "./tool.types.js";

export type NextclawKernelSnapshot = {
  agents: AgentRecord[];
  tasks: TaskRecord[];
  sessions: SessionRecord[];
  contexts: ContextRecord[];
  tools: ToolRecord[];
  skills: SkillRecord[];
  llmProviders: LlmProviderRecord[];
  automations: AutomationRecord[];
  channels: ChannelRecord[];
};
