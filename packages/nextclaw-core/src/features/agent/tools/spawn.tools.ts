import {
  Tool,
  createToolExecutionContext,
  normalizeToolParams,
  type ToolExecutionContext,
} from "./base.tools.js";
import type { SubagentService } from "@core/features/agent/services/subagent.service.js";

export class SpawnTool extends Tool {
  private channel = "cli";
  private chatId = "direct";
  private sessionModel: string | undefined;
  private sessionKey: string | undefined;
  private agentId: string | undefined;

  constructor(private manager: SubagentService) {
    super();
  }

  get name(): string {
    return "spawn";
  }

  get description(): string {
    return "Spawn a background subagent to handle a task";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        task: { type: "string", description: "Task for the subagent" },
        label: { type: "string", description: "Optional label" },
        model: { type: "string", description: "Optional model override for this subagent run" }
      },
      required: ["task"]
    };
  }

  setContext = (
    channel: string,
    chatId: string,
    sessionModel?: string,
    sessionKey?: string,
    agentId?: string
  ): void => {
    this.channel = channel;
    this.chatId = chatId;
    this.sessionModel = sessionModel;
    this.sessionKey = sessionKey;
    this.agentId = agentId;
  };

  execute = async (args: unknown, context?: ToolExecutionContext): Promise<unknown> => {
    const params = normalizeToolParams(args);
    const toolContext = context ?? createToolExecutionContext();
    const { task: taskParam, label: labelParam, model: modelParam } = params;
    const task = String(taskParam ?? "");
    const label = labelParam ? String(labelParam) : undefined;
    const model = typeof modelParam === "string" && modelParam.trim().length > 0 ? modelParam.trim() : undefined;
    return this.manager.spawn({
      task,
      label,
      model,
      sessionModel: this.sessionModel,
      originChannel: this.channel,
      originChatId: this.chatId,
      originSessionKey: this.sessionKey,
      originAgentId: this.agentId,
      originToolCallId: toolContext.toolCallId || undefined,
    });
  };
}
