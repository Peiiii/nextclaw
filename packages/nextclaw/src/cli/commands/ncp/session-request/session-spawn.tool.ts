import { Tool } from "@nextclaw/core";
import type { SessionCreationService } from "./session-creation.service.js";
import type { SessionRequestBroker } from "./session-request-broker.js";
import type { SessionRequestNotifyMode } from "./session-request.types.js";

function readRequiredString(value: unknown, key: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string.`);
  }
  return value.trim();
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

type SessionSpawnScope = "standalone" | "child";

type SessionSpawnRequestOptions = {
  notify: SessionRequestNotifyMode;
};

function readSpawnScope(value: unknown): SessionSpawnScope {
  const normalized = readOptionalString(value)?.toLowerCase();
  if (!normalized || normalized === "standalone") {
    return "standalone";
  }
  if (normalized === "child") {
    return "child";
  }
  throw new Error('scope must be "standalone" or "child".');
}

function readSpawnRequestOptions(
  value: unknown,
): SessionSpawnRequestOptions | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("request must be an object.");
  }
  const record = value as Record<string, unknown>;
  const notifyMode = readOptionalString(record.notify)?.toLowerCase();
  if (notifyMode === "none" || notifyMode === "final_reply") {
    return {
      notify: notifyMode,
    };
  }
  throw new Error('request.notify must be "none" or "final_reply".');
}

export class SessionSpawnTool extends Tool {
  private sourceSessionId = "";
  private sourceSessionMetadata: Record<string, unknown> = {};
  private handoffDepth = 0;

  constructor(
    private readonly sessionCreationService: SessionCreationService,
    private readonly sessionRequestBroker: SessionRequestBroker,
  ) {
    super();
  }

  get name(): string {
    return "sessions_spawn";
  }

  get description(): string {
    return "Create a new session. Use scope=\"child\" to create a child session of the current flow, and add request.notify to control whether this session should continue after the new session finishes.";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "Seed text used to title the new session. If request is provided, this same task is also sent as the first request to that new session.",
        },
        scope: {
          type: "string",
          enum: ["standalone", "child"],
          description: "Whether the new session should be a standalone thread or a child session of the current session.",
        },
        title: {
          type: "string",
          description: "Optional explicit session title.",
        },
        model: {
          type: "string",
          description: "Optional model override for the new session.",
        },
        runtime: {
          type: "string",
          description: "Optional runtime override for the new session, for example native or codex.",
        },
        agentId: {
          type: "string",
          description: "Optional target agent id for the new session. Omit to use the default agent.",
        },
        request: {
          type: "object",
          description: "Optional initial request to run immediately inside the new session.",
          properties: {
            notify: {
              type: "string",
              enum: ["none", "final_reply"],
              description: "Whether the current session should continue after the new session finishes. Use \"final_reply\" to continue after the new session reaches its final reply.",
            },
          },
          required: ["notify"],
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

  execute = async (params: Record<string, unknown>, toolCallId?: string): Promise<unknown> => {
    const {
      agentId: rawAgentId,
      model: rawModel,
      request: rawRequest,
      runtime: rawRuntime,
      scope: rawScope,
      task: rawTask,
      title: rawTitle
    } = params;
    const task = readRequiredString(rawTask, "task");
    const scope = readSpawnScope(rawScope);
    const request = readSpawnRequestOptions(rawRequest);
    const parentSessionId = scope === "child" ? this.readParentSessionIdOrThrow() : undefined;

    if (request) {
      return this.sessionRequestBroker.spawnSessionAndRequest({
        sourceSessionId: this.sourceSessionId,
        sourceToolCallId: toolCallId,
        sourceSessionMetadata: this.sourceSessionMetadata,
        task,
        title: readOptionalString(rawTitle),
        agentId: readOptionalString(rawAgentId),
        model: readOptionalString(rawModel),
        runtime: readOptionalString(rawRuntime),
        handoffDepth: this.handoffDepth,
        ...(parentSessionId ? { parentSessionId } : {}),
        notify: request.notify,
      });
    }

    const session = this.sessionCreationService.createSession({
      task,
      title: readOptionalString(rawTitle),
      sourceSessionMetadata: this.sourceSessionMetadata,
      agentId: readOptionalString(rawAgentId),
      model: readOptionalString(rawModel),
      runtime: readOptionalString(rawRuntime),
      ...(parentSessionId ? { parentSessionId } : {}),
    });

    return {
      kind: "nextclaw.session",
      sessionId: session.sessionId,
      ...(session.agentId ? { agentId: session.agentId } : {}),
      ...(session.parentSessionId ? { parentSessionId: session.parentSessionId } : {}),
      isChildSession: Boolean(session.parentSessionId),
      lifecycle: session.lifecycle,
      title: session.title,
      sessionType: session.sessionType,
      createdAt: session.createdAt,
    };
  };

  private readParentSessionIdOrThrow = (): string => {
    const sourceSessionId = this.sourceSessionId.trim();
    if (!sourceSessionId) {
      throw new Error('scope="child" requires an active source session.');
    }
    return sourceSessionId;
  };
}
