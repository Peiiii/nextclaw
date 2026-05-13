import type { AgentSessionRecord, AgentSessionStore } from "./agent-backend.types.js";

export class InMemoryAgentSessionStore implements AgentSessionStore {
  private readonly sessions = new Map<string, AgentSessionRecord>();

  getSession = async (sessionId: string): Promise<AgentSessionRecord | null> => {
    const session = this.sessions.get(sessionId);
    return session ? structuredClone(session) : null;
  };

  listSessions = async (): Promise<AgentSessionRecord[]> => {
    return [...this.sessions.values()].map((session) => structuredClone(session));
  };

  saveSession = async (session: AgentSessionRecord): Promise<void> => {
    this.sessions.set(session.sessionId, structuredClone(session));
  };

  replaceSession = async (session: AgentSessionRecord): Promise<void> => {
    this.sessions.set(session.sessionId, structuredClone(session));
  };

  deleteSession = async (sessionId: string): Promise<AgentSessionRecord | null> => {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    this.sessions.delete(sessionId);
    return structuredClone(session);
  };
}
