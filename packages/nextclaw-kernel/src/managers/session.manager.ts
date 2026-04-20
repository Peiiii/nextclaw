import type { AgentId, SessionId, TaskId } from "@/types/entity-ids.types.js";
import type { SessionMessage, SessionRecord } from "@/types/session.types.js";

export class SessionManager {
  readonly listSessions = () => {
    throw new Error("SessionManager.listSessions is not implemented.");
  };

  readonly getSession = (sessionId: SessionId) => {
    void sessionId;
    throw new Error("SessionManager.getSession is not implemented.");
  };

  readonly requireSession = (sessionId: SessionId) => {
    void sessionId;
    throw new Error("SessionManager.requireSession is not implemented.");
  };

  readonly createSession = (input?: {
    title?: string;
    agentId?: AgentId | null;
    metadata?: Record<string, unknown>;
  }) => {
    void input;
    throw new Error("SessionManager.createSession is not implemented.");
  };

  readonly saveSession = (session: SessionRecord) => {
    void session;
    throw new Error("SessionManager.saveSession is not implemented.");
  };

  readonly appendMessage = (sessionId: SessionId, message: SessionMessage) => {
    void sessionId;
    void message;
    throw new Error("SessionManager.appendMessage is not implemented.");
  };

  readonly attachTask = (sessionId: SessionId, taskId: TaskId) => {
    void sessionId;
    void taskId;
    throw new Error("SessionManager.attachTask is not implemented.");
  };

  readonly closeSession = (sessionId: SessionId) => {
    void sessionId;
    throw new Error("SessionManager.closeSession is not implemented.");
  };
}
