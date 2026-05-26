import {
  normalizeToolParams,
  type ToolExecutionContext,
} from "@nextclaw/core";
import type { NcpTool } from "@nextclaw/ncp";
import type { SessionRequestManager } from "@kernel/features/session-request/index.js";

function readRequiredString(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string.`);
  }
  return value.trim();
}

function readOptionalString(params: Record<string, unknown>, key: string): string | undefined {
  const value = params[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class SessionRequestTool implements NcpTool {
  readonly name = "sessions_request";
  readonly description =
    "Send one task to another session. Use notify to control whether this session should continue after the target session finishes.";
  readonly parameters = {
    type: "object",
    properties: {
      target: {
        type: "object",
        description: "Target session reference. Pass an object like {\"session_id\":\"...\"}, not a bare string.",
        properties: {
          session_id: {
            type: "string",
            description: "Existing target session id.",
          },
        },
        required: ["session_id"],
      },
      task: {
        type: "string",
        description: "Task to send to the target session.",
      },
      notify: {
        type: "string",
        enum: ["none", "final_reply"],
        description: "Whether the current session should continue after the target session finishes. Use \"final_reply\" to continue after the target session reaches its final reply.",
      },
      title: {
        type: "string",
        description: "Optional card title override.",
      },
    },
    required: ["target", "task", "notify"],
  };
  private sourceSessionId = "";
  private handoffDepth = 0;

  constructor(private readonly manager: SessionRequestManager) {}

  setContext = (params: {
    sourceSessionId: string;
    handoffDepth?: number;
  }): void => {
    this.sourceSessionId = params.sourceSessionId;
    this.handoffDepth = params.handoffDepth ?? 0;
  };

  execute = async (args: unknown, context?: ToolExecutionContext): Promise<unknown> => {
    const params = normalizeToolParams(args);
    const target = params.target;
    if (!target || typeof target !== "object" || Array.isArray(target)) {
      throw new Error("target must be an object.");
    }
    const task = readRequiredString(params, "task");
    const notifyMode = readOptionalString(params, "notify")?.toLowerCase();
    if (notifyMode !== "none" && notifyMode !== "final_reply") {
      throw new Error('notify must be "none" or "final_reply".');
    }

    return this.manager.requestSession({
      sourceSessionId: this.sourceSessionId,
      sourceToolCallId: context?.toolCallId,
      updateToolCallResult: context?.updateToolCallResult,
      targetSessionId: readRequiredString(target as Record<string, unknown>, "session_id"),
      task,
      title: readOptionalString(params, "title"),
      notify: notifyMode,
      handoffDepth: this.handoffDepth,
    });
  };
}
