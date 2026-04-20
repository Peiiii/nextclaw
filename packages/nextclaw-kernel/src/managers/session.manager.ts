import type { AgentId, SessionId, TaskId } from "@/types/entity-ids.types.js";
import type { SessionMessage, SessionRecord } from "@/types/session.types.js";

export class SessionManager {
  readonly listSessions = () => {
    // TODO(kernel): return the current session registry snapshot.
    throw new Error("SessionManager.listSessions is not implemented.");
  };

  readonly getSession = (sessionId: SessionId) => {
    // TODO(kernel): look up a session by id.
    void sessionId;
    throw new Error("SessionManager.getSession is not implemented.");
  };

  readonly requireSession = (sessionId: SessionId) => {
    // TODO(kernel): resolve a session and throw a domain error when missing.
    void sessionId;
    throw new Error("SessionManager.requireSession is not implemented.");
  };

  readonly createSession = (input?: {
    title?: string;
    agentId?: AgentId | null;
    metadata?: Record<string, unknown>;
  }) => {
    // TODO(kernel): create and persist a new session aggregate.
    void input;
    throw new Error("SessionManager.createSession is not implemented.");
  };

  readonly saveSession = (session: SessionRecord) => {
    // TODO(kernel): persist session state.
    void session;
    throw new Error("SessionManager.saveSession is not implemented.");
  };

  readonly appendMessage = (sessionId: SessionId, message: SessionMessage) => {
    // TODO(kernel): append a message to a session transcript.
    void sessionId;
    void message;
    throw new Error("SessionManager.appendMessage is not implemented.");
  };

  readonly attachTask = (sessionId: SessionId, taskId: TaskId) => {
    // TODO(kernel): attach a task to a session aggregate.
    void sessionId;
    void taskId;
    throw new Error("SessionManager.attachTask is not implemented.");
  };

  readonly closeSession = (sessionId: SessionId) => {
    // TODO(kernel): close a session and mark lifecycle metadata.
    void sessionId;
    throw new Error("SessionManager.closeSession is not implemented.");
  };
}
