import { Tool } from "@nextclaw/core";
import { SessionCreationService } from "./session-creation.service.js";

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
  private agentId: string | undefined;

  constructor(private readonly sessionCreationService: SessionCreationService) {
    super();
  }

  get name(): string {
    return "sessions_spawn";
  }

  get description(): string {
    return "Create a new session without sending it a task yet.";
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
      },
      required: ["task"],
    };
  }

  setContext = (params: {
    sourceSessionId: string;
    sourceSessionMetadata: Record<string, unknown>;
    agentId?: string;
  }): void => {
    this.sourceSessionId = params.sourceSessionId;
    this.sourceSessionMetadata = structuredClone(params.sourceSessionMetadata);
    this.agentId = params.agentId;
  };

  execute = async (params: Record<string, unknown>): Promise<unknown> => {
    const task = readRequiredString(params.task, "task");
    const session = this.sessionCreationService.createSession({
      task,
      title: readOptionalString(params.title),
      sourceSessionMetadata: this.sourceSessionMetadata,
      agentId: this.agentId,
      model: readOptionalString(params.model),
    });

    return {
      kind: "nextclaw.session",
      sessionId: session.sessionId,
      ...(session.parentSessionId ? { parentSessionId: session.parentSessionId } : {}),
      isChildSession: false,
      lifecycle: session.lifecycle,
      title: session.title,
      sessionType: session.sessionType,
      createdAt: session.createdAt,
    };
  };
}
