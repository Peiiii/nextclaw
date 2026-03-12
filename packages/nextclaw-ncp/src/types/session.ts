import type { NcpMessage } from "./message.js";

export type NcpSessionStatus = "idle" | "running";

export type NcpSessionSummary = {
  sessionId: string;
  messageCount: number;
  updatedAt: string;
  status?: NcpSessionStatus;
  activeRunId?: string;
};

export type ListSessionsOptions = {
  limit?: number;
  cursor?: string;
};

export type ListMessagesOptions = {
  limit?: number;
  cursor?: string;
};

/**
 * Optional API for querying session list and message history.
 * Implementations that support persistence can provide this alongside NcpClientEndpoint.
 */
export interface NcpSessionQueryApi {
  listSessions(options?: ListSessionsOptions): Promise<NcpSessionSummary[]>;
  listSessionMessages(sessionId: string, options?: ListMessagesOptions): Promise<NcpMessage[]>;
  getSession(sessionId: string): Promise<NcpSessionSummary | null>;
}
