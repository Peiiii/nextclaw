import { Tool } from "@nextclaw/core";
import type { SessionRequestBroker } from "./session-request-broker.js";
import type { SessionRequestDeliveryMode } from "./session-request.types.js";

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

export class SpawnChildSessionTool extends Tool {
  private sourceSessionId = "";
  private sourceSessionMetadata: Record<string, unknown> = {};
  private handoffDepth = 0;

  constructor(private readonly broker: SessionRequestBroker) {
    super();
  }

  get name(): string {
    return "spawn";
  }

  get description(): string {
    return "Create a child session, start the delegated task in the background, return a running child-session handle immediately, and automatically continue this session with the child's final reply when it finishes.";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "Task to start immediately inside the child session.",
        },
        label: {
          type: "string",
          description: "Optional child session title shown in the session list and tool card.",
        },
        model: {
          type: "string",
          description: "Optional model override used only for the child session.",
        },
        agentId: {
          type: "string",
          description: "Optional target agent id for the child session. Omit to use the default agent for that child.",
        },
      },
      required: ["task"],
    };
  }

  setContext = (params: {
    sourceSessionId: string;
    sourceSessionMetadata: Record<string, unknown>;
    handoffDepth?: number;
  }): void => {
    this.sourceSessionId = params.sourceSessionId;
    this.sourceSessionMetadata = structuredClone(params.sourceSessionMetadata);
    this.handoffDepth = params.handoffDepth ?? 0;
  };

  execute = async (
    params: Record<string, unknown>,
    toolCallId?: string,
  ): Promise<unknown> => {
    const task = readRequiredString(params, "task");
    return this.broker.spawnChildSessionAndRequest({
      sourceSessionId: this.sourceSessionId,
      sourceToolCallId: toolCallId,
      sourceSessionMetadata: this.sourceSessionMetadata,
      task,
      title: readOptionalString(params, "label"),
      model: readOptionalString(params, "model"),
      handoffDepth: this.handoffDepth,
      agentId: readOptionalString(params, "agentId"),
    });
  };
}

export class SessionRequestTool extends Tool {
  private sourceSessionId = "";
  private handoffDepth = 0;

  constructor(private readonly broker: SessionRequestBroker) {
    super();
  }

  get name(): string {
    return "sessions_request";
  }

  get description(): string {
    return "Send one task to another session. Use this after sessions_spawn or to reuse an existing session, and optionally resume this session when the target final reply is ready.";
  }

  get parameters(): Record<string, unknown> {
    return {
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
        await: {
          type: "string",
          enum: ["final_reply"],
          description: "Phase 1 requires waiting for the target final reply.",
        },
        delivery: {
          type: "string",
          enum: ["none", "resume_source"],
          description: "How the completion should be delivered back to the source session.",
        },
        title: {
          type: "string",
          description: "Optional card title override.",
        },
      },
      required: ["target", "task", "await", "delivery"],
    };
  }

  setContext = (params: {
    sourceSessionId: string;
    handoffDepth?: number;
  }): void => {
    this.sourceSessionId = params.sourceSessionId;
    this.handoffDepth = params.handoffDepth ?? 0;
  };

  execute = async (
    params: Record<string, unknown>,
    toolCallId?: string,
  ): Promise<unknown> => {
    const target = params.target;
    if (!target || typeof target !== "object" || Array.isArray(target)) {
      throw new Error("target must be an object.");
    }
    const task = readRequiredString(params, "task");
    const awaitMode = readRequiredString(params, "await");
    const deliveryMode = readRequiredString(params, "delivery") as SessionRequestDeliveryMode;
    if (awaitMode !== "final_reply") {
      throw new Error("Phase 1 only supports await=\"final_reply\".");
    }

    return this.broker.requestSession({
      sourceSessionId: this.sourceSessionId,
      sourceToolCallId: toolCallId,
      targetSessionId: readRequiredString(target as Record<string, unknown>, "session_id"),
      task,
      title: readOptionalString(params, "title"),
      awaitMode: "final_reply",
      deliveryMode,
      handoffDepth: this.handoffDepth,
    });
  };
}
