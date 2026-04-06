import { Tool } from "@nextclaw/core";
import type { SessionCreationService } from "./session-creation.service.js";

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

export class SessionSpawnTool extends Tool {
  private sourceSessionId = "";
  private sourceSessionMetadata: Record<string, unknown> = {};

  constructor(private readonly sessionCreationService: SessionCreationService) {
    super();
  }

  get name(): string {
    return "sessions_spawn";
  }

  get description(): string {
    return "Create a standalone session. Usually follow this with sessions_request if you want the new session to start working immediately.";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "Seed text used to title the new session.",
        },
        title: {
          type: "string",
          description: "Optional explicit session title.",
        },
        model: {
          type: "string",
          description: "Optional model override for the new session.",
        },
        agentId: {
          type: "string",
          description: "Optional target agent id for the new session. Omit to use the default agent.",
        },
      },
      required: ["task"],
    };
  }

  setContext = (params: {
    sourceSessionId: string;
    sourceSessionMetadata: Record<string, unknown>;
  }): void => {
    this.sourceSessionId = params.sourceSessionId;
    this.sourceSessionMetadata = structuredClone(params.sourceSessionMetadata);
  };

  execute = async (params: Record<string, unknown>): Promise<unknown> => {
    const task = readRequiredString(params.task, "task");
    const session = this.sessionCreationService.createSession({
      task,
      title: readOptionalString(params.title),
      sourceSessionMetadata: this.sourceSessionMetadata,
      agentId: readOptionalString(params.agentId),
      model: readOptionalString(params.model),
    });

    return {
      kind: "nextclaw.session",
      sessionId: session.sessionId,
      ...(session.agentId ? { agentId: session.agentId } : {}),
      ...(session.parentSessionId ? { parentSessionId: session.parentSessionId } : {}),
      isChildSession: false,
      lifecycle: session.lifecycle,
      title: session.title,
      sessionType: session.sessionType,
      createdAt: session.createdAt,
    };
  };
}
