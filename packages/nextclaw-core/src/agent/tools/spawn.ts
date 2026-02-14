import { Tool } from "./base.js";
import type { SubagentManager } from "../subagent.js";

export class SpawnTool extends Tool {
  private channel = "cli";
  private chatId = "direct";

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
        label: { type: "string", description: "Optional label" }
      },
      required: ["task"]
    };
  }

  setContext(channel: string, chatId: string): void {
    this.channel = channel;
    this.chatId = chatId;
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const task = String(params.task ?? "");
    const label = params.label ? String(params.label) : undefined;
    return this.manager.spawn({
      task,
      label,
      originChannel: this.channel,
      originChatId: this.chatId
    });
  }
}
