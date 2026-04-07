import { Tool } from "./base.js";
import type { SubagentManager } from "../subagent.js";

export class SpawnTool extends Tool {
  private channel = "cli";
  private chatId = "direct";
  private sessionModel: string | undefined;
  private sessionKey: string | undefined;
  private agentId: string | undefined;

  constructor(private manager: SubagentManager) {
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

  execute = async (params: Record<string, unknown>, toolCallId?: string): Promise<unknown> => {
    const task = String(params.task ?? "");
    const label = params.label ? String(params.label) : undefined;
    const model = typeof params.model === "string" && params.model.trim().length > 0 ? params.model.trim() : undefined;
    return this.manager.spawn({
      task,
      label,
      model,
      sessionModel: this.sessionModel,
      originChannel: this.channel,
      originChatId: this.chatId,
      originSessionKey: this.sessionKey,
      originAgentId: this.agentId,
      originToolCallId: toolCallId,
    });
  };
}
