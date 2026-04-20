import type { AgentId, SessionId, TaskId } from "@/types/entity-ids.types.js";
import type { SessionMessage, SessionRecord } from "@/types/session.types.js";

export abstract class SessionManager {
  abstract listSessions(): SessionRecord[];
  abstract getSession(sessionId: SessionId): SessionRecord | null;
  abstract requireSession(sessionId: SessionId): SessionRecord;
  abstract createSession(input?: {
    title?: string;
    agentId?: AgentId | null;
    metadata?: Record<string, unknown>;
  }): SessionRecord;
  abstract saveSession(session: SessionRecord): void;
  abstract appendMessage(sessionId: SessionId, message: SessionMessage): SessionRecord;
  abstract attachTask(sessionId: SessionId, taskId: TaskId): SessionRecord;
  abstract closeSession(sessionId: SessionId): void;
}
