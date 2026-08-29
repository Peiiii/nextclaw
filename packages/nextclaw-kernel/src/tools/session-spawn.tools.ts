import {
  normalizeToolParams,
  type SessionRequestNotifyMode,
  type SessionRequestWaitMode,
  type ToolExecutionContext,
} from "@nextclaw/core";
import type { NcpRunTriggerInput, NcpTool } from "@nextclaw/ncp";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type { SessionRequestManager } from "@kernel/features/session-request/index.js";
import { attachSourceToolCall } from "@kernel/utils/agent-run-trigger.utils.js";

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

function readSpawnStart(value: unknown): boolean {
  if (typeof value === "undefined") {
    return true;
  }
  if (typeof value === "boolean") {
    return value;
  }
  throw new Error("start must be a boolean.");
}

function readSpawnWait(value: unknown): SessionRequestWaitMode {
  const waitMode = readOptionalString(value)?.toLowerCase();
  if (!waitMode && typeof value === "undefined") {
    return "none";
  }
  if (waitMode === "none" || waitMode === "final_reply") {
    return waitMode;
  }
  throw new Error('wait must be "none" or "final_reply".');
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
    "Create a new session and start its task immediately by default. Use start=false only to create an idle session; wait controls blocking and notify controls completion delivery.";
  readonly parameters = {
    type: "object",
    properties: {
      task: {
        type: "string",
        description: "Task to run immediately in the new session by default. With start=false, it is used only to seed the session title.",
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
        description: "Optional completion delivery policy. Defaults to \"final_reply\", which continues this session after the new session finishes; use \"none\" for no follow-up notification.",
      },
      wait: {
        type: "string",
        enum: ["none", "final_reply"],
        description: "Optional blocking policy. Defaults to \"none\" so this session continues immediately; use \"final_reply\" only when the current tool call must wait for the result.",
      },
      start: {
        type: "boolean",
        description: "Optional. Defaults to true. Set false only when an idle session should be created without running the task.",
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
  private trigger: NcpRunTriggerInput | null = null;

  constructor(
    private readonly sessionManager: SessionManager,
    private readonly sessionRequestManager: SessionRequestManager,
  ) {}

  setContext = (params: {
    sourceSessionId: string;
    sourceSessionMetadata: Record<string, unknown>;
    handoffDepth?: number;
    trigger: NcpRunTriggerInput;
  }): void => {
    const { handoffDepth, sourceSessionId, sourceSessionMetadata, trigger } = params;
    this.sourceSessionId = sourceSessionId;
    this.sourceSessionMetadata = structuredClone(sourceSessionMetadata);
    this.handoffDepth = handoffDepth ?? 0;
    this.trigger = structuredClone(trigger);
  };

  execute = async (args: unknown, context?: ToolExecutionContext): Promise<unknown> => {
    const { toolCallId } = context ?? {};
    const params = normalizeToolParams(args);
    const {
      agentId: rawAgentId,
      model: rawModel,
      notify: rawNotify,
      runtime: rawRuntime,
      scope: rawScope,
      start: rawStart,
      task: rawTask,
      title: rawTitle,
      wait: rawWait,
      inheritContext: rawInheritContext,
    } = params;
    const task = readRequiredString(rawTask, "task");
    const scope = readSpawnScope(rawScope);
    const start = readSpawnStart(rawStart);
    const requestedNotify = readSpawnNotify(rawNotify);
    const wait = readSpawnWait(rawWait);
    if (!start && (requestedNotify === "final_reply" || wait === "final_reply")) {
      throw new Error("start=false cannot request waiting or completion notification.");
    }
    const notify = requestedNotify ?? "final_reply";
    const inheritContext = readInheritContext(rawInheritContext);
    if (inheritContext && scope !== "child") {
      throw new Error('inheritContext=true requires scope="child".');
    }
    const parentSessionId = scope === "child" ? this.readParentSessionIdOrThrow() : undefined;
    const contextInheritance = inheritContext
      ? { anchorToolCallId: toolCallId }
      : undefined;
    const trigger = attachSourceToolCall(
      this.readTriggerOrThrow(),
      toolCallId,
    );

    if (start) {
      return this.sessionRequestManager.spawnSessionAndRequest({
        sourceSessionId: this.sourceSessionId,
        sourceToolCallId: toolCallId,
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
        wait,
        trigger,
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
      metadataOverrides: {
        session_creation_trigger: structuredClone(trigger),
      },
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

  private readTriggerOrThrow = (): NcpRunTriggerInput => {
    if (!this.trigger) {
      throw new Error("sessions_spawn requires an active run trigger context.");
    }
    return structuredClone(this.trigger);
  };
}
