import {
  normalizeToolParams,
  type ToolExecutionContext,
} from "@nextclaw/core";
import type { NcpRunTriggerInput, NcpTool } from "@nextclaw/ncp";
import type { SessionRequestManager } from "@kernel/features/session-request/index.js";
import { attachSourceToolCall } from "@kernel/utils/agent-run-trigger.utils.js";

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
    "Send one task to another session. The request starts immediately; wait controls blocking and notify controls completion delivery.";
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
        description: "Optional completion delivery policy. Defaults to \"final_reply\"; use \"none\" for no follow-up notification.",
      },
      wait: {
        type: "string",
        enum: ["none", "final_reply"],
        description: "Optional blocking policy. Defaults to \"none\"; use \"final_reply\" only when this tool call must wait for the target result.",
      },
      title: {
        type: "string",
        description: "Optional card title override.",
      },
    },
    required: ["target", "task"],
  };
  private sourceSessionId = "";
  private handoffDepth = 0;
  private trigger: NcpRunTriggerInput | null = null;

  constructor(private readonly manager: SessionRequestManager) {}

  setContext = (params: {
    sourceSessionId: string;
    handoffDepth?: number;
    trigger: NcpRunTriggerInput;
  }): void => {
    this.sourceSessionId = params.sourceSessionId;
    this.handoffDepth = params.handoffDepth ?? 0;
    this.trigger = structuredClone(params.trigger);
  };

  execute = async (args: unknown, context?: ToolExecutionContext): Promise<unknown> => {
    const params = normalizeToolParams(args);
    const target = params.target;
    if (!target || typeof target !== "object" || Array.isArray(target)) {
      throw new Error("target must be an object.");
    }
    const task = readRequiredString(params, "task");
    const notifyMode = readOptionalString(params, "notify")?.toLowerCase() ?? "final_reply";
    if (notifyMode !== "none" && notifyMode !== "final_reply") {
      throw new Error('notify must be "none" or "final_reply".');
    }
    const waitMode = readOptionalString(params, "wait")?.toLowerCase() ?? "none";
    if (waitMode !== "none" && waitMode !== "final_reply") {
      throw new Error('wait must be "none" or "final_reply".');
    }

    return this.manager.requestSession({
      sourceSessionId: this.sourceSessionId,
      sourceToolCallId: context?.toolCallId,
      targetSessionId: readRequiredString(target as Record<string, unknown>, "session_id"),
      task,
      title: readOptionalString(params, "title"),
      notify: notifyMode,
      wait: waitMode,
      handoffDepth: this.handoffDepth,
      trigger: attachSourceToolCall(this.readTriggerOrThrow(), context?.toolCallId),
    });
  };

  private readTriggerOrThrow = (): NcpRunTriggerInput => {
    if (!this.trigger) {
      throw new Error("sessions_request requires an active run trigger context.");
    }
    return structuredClone(this.trigger);
  };
}
