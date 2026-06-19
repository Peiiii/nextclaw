import {
  normalizeToolParams,
  type SessionRequestNotifyMode,
  type ToolExecutionContext,
} from "@nextclaw/core";
import type { NcpTool } from "@nextclaw/ncp";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type { SessionRequestManager } from "@kernel/features/session-request/index.js";

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

function readSpawnNotify(value: unknown): SessionRequestNotifyMode | undefined {
  const notifyMode = readOptionalString(value)?.toLowerCase();
  if (!notifyMode && typeof value === "undefined") {
    return undefined;
  }
  if (notifyMode === "none" || notifyMode === "final_reply") {
    return notifyMode;
  }
  throw new Error('notify must be "none" or "final_reply".');
}

function readInheritContext(value: unknown): boolean {
  if (typeof value === "undefined") {
    return false;
  }
  if (typeof value === "boolean") {
    return value;
  }
  throw new Error("inheritContext must be a boolean.");
}

export class SessionSpawnTool implements NcpTool {
  readonly name = "sessions_spawn";
  readonly description =
    "Create a new session. Use scope=\"child\" to create a child session of the current flow, and add notify when the new session should start immediately.";
  readonly parameters = {
    type: "object",
    properties: {
      task: {
        type: "string",
        description: "Seed text used to title the new session. If notify is provided, this same task is also sent as the first request to that new session.",
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
      notify: {
        type: "string",
        enum: ["none", "final_reply"],
        description: "Optional. Starts the new session immediately. Use \"final_reply\" to continue this session after the new session reaches its final reply, or \"none\" to let it run independently.",
      },
      inheritContext: {
        type: "boolean",
        description: "Child sessions only. When true, the child starts with parent context inherited up to this tool call.",
      },
    },
    required: ["task"],
    additionalProperties: false,
  };
  private sourceSessionId = "";
  private sourceSessionMetadata: Record<string, unknown> = {};
  private handoffDepth = 0;

  constructor(
    private readonly sessionManager: SessionManager,
    private readonly sessionRequestManager: SessionRequestManager,
  ) {}

  setContext = (params: {
    sourceSessionId: string;
    sourceSessionMetadata: Record<string, unknown>;
    handoffDepth?: number;
  }): void => {
    this.sourceSessionId = params.sourceSessionId;
    this.sourceSessionMetadata = structuredClone(params.sourceSessionMetadata);
    this.handoffDepth = params.handoffDepth ?? 0;
  };

  execute = async (args: unknown, context?: ToolExecutionContext): Promise<unknown> => {
    const params = normalizeToolParams(args);
    const {
      agentId: rawAgentId,
      model: rawModel,
      notify: rawNotify,
      runtime: rawRuntime,
      scope: rawScope,
      task: rawTask,
      title: rawTitle,
      inheritContext: rawInheritContext,
    } = params;
    const task = readRequiredString(rawTask, "task");
    const scope = readSpawnScope(rawScope);
    const notify = readSpawnNotify(rawNotify);
    const inheritContext = readInheritContext(rawInheritContext);
    if (inheritContext && scope !== "child") {
      throw new Error('inheritContext=true requires scope="child".');
    }
    const parentSessionId = scope === "child" ? this.readParentSessionIdOrThrow() : undefined;
    const contextInheritance = inheritContext
      ? { anchorToolCallId: context?.toolCallId }
      : undefined;

    if (notify) {
      return this.sessionRequestManager.spawnSessionAndRequest({
        sourceSessionId: this.sourceSessionId,
        sourceToolCallId: context?.toolCallId,
        updateToolCallResult: context?.updateToolCallResult,
        sourceSessionMetadata: this.sourceSessionMetadata,
        task,
        title: readOptionalString(rawTitle),
        agentId: readOptionalString(rawAgentId),
        model: readOptionalString(rawModel),
        runtime: readOptionalString(rawRuntime),
        contextInheritance,
        handoffDepth: this.handoffDepth,
        parentSessionId,
        notify,
      });
    }

    const session = await this.sessionManager.createSession({
      sourceSessionId: this.sourceSessionId,
      task,
      title: readOptionalString(rawTitle),
      sourceSessionMetadata: this.sourceSessionMetadata,
      agentId: readOptionalString(rawAgentId),
      model: readOptionalString(rawModel),
      runtime: readOptionalString(rawRuntime),
      contextInheritance,
      parentSessionId,
    });

    return {
      kind: "nextclaw.session",
      sessionId: session.sessionId,
      agentId: session.agentId,
      parentSessionId: session.parentSessionId,
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
