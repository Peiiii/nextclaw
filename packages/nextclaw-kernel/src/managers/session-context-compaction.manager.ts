import type { EventBus } from "@nextclaw/shared";
import { eventKeys } from "@nextclaw/shared";
import type { AgentRuntimeManager } from "@kernel/managers/agent-runtime.manager.js";
import type { SessionRunManager } from "@kernel/managers/session-run.manager.js";
import type { SessionManager } from "@kernel/managers/session.manager.js";

export type SessionContextCompactionErrorCode =
  | "CONTEXT_COMPACTION_UNSUPPORTED"
  | "NOTHING_TO_COMPACT"
  | "SESSION_BUSY"
  | "SESSION_NOT_FOUND";

export class SessionContextCompactionError extends Error {
  constructor(
    readonly code: SessionContextCompactionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SessionContextCompactionError";
  }
}

export function isSessionContextCompactionError(
  error: unknown,
): error is SessionContextCompactionError {
  return error instanceof SessionContextCompactionError;
}

export type SessionContextCompactionResult = {
  compacted: true;
  sessionId: string;
};

export class SessionContextCompactionManager {
  constructor(
    private readonly agentRuntimeManager: AgentRuntimeManager,
    private readonly eventBus: EventBus,
    private readonly sessionManager: SessionManager,
    private readonly sessionRunManager: SessionRunManager,
  ) {}

  compact = async (
    requestedSessionId: string,
  ): Promise<SessionContextCompactionResult> => {
    const sessionId = requestedSessionId.trim();
    const summary = sessionId
      ? await this.sessionManager.getSession(sessionId)
      : null;
    if (!summary) {
      throw new SessionContextCompactionError(
        "SESSION_NOT_FOUND",
        `Session not found: ${sessionId || requestedSessionId}`,
      );
    }
    const sessionRun =
      this.sessionRunManager.getSessionRun(sessionId) ??
      (await this.sessionRunManager.createSessionRun(sessionId));
    if (sessionRun.isRunning()) {
      throw new SessionContextCompactionError(
        "SESSION_BUSY",
        `Session is running: ${sessionId}`,
      );
    }
    const session = await this.sessionManager.getAgentRunSession(sessionId);
    const runtime = this.agentRuntimeManager.getOrCreate({
      agentRuntimeId: session.agentRuntimeId,
      session,
      sessionRun,
    });
    if (!runtime.compactContext) {
      throw new SessionContextCompactionError(
        "CONTEXT_COMPACTION_UNSUPPORTED",
        `Agent runtime does not support context compaction: ${session.agentRuntimeId}`,
      );
    }
    const result = await runtime.compactContext({ session, sessionRun });
    if (!result.supported) {
      throw new SessionContextCompactionError(
        "CONTEXT_COMPACTION_UNSUPPORTED",
        `Agent runtime does not support context compaction: ${session.agentRuntimeId}`,
      );
    }
    if (!result.performed) {
      throw new SessionContextCompactionError(
        "NOTHING_TO_COMPACT",
        "There is not enough session history to compact.",
      );
    }
    if (result.events.length > 0) {
      await sessionRun.applyEvents(result.events);
      for (const event of result.events) {
        this.eventBus.emit(eventKeys.ncpEvent, event, {
          emittedAt: new Date().toISOString(),
          source: "session-context-compaction",
        });
      }
    }
    return { compacted: true, sessionId };
  };
}
