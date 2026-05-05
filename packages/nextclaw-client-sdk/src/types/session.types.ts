import type { NcpMessage, NcpSessionStatus, NcpSessionSummary } from "@nextclaw/ncp";

export type NextClawSessionSummary = NcpSessionSummary;

export type NextClawSessionList = {
  sessions: NextClawSessionSummary[];
  total: number;
};

export type NextClawSessionMessages = {
  sessionId: string;
  status: NcpSessionStatus;
  messages: NcpMessage[];
  contextWindow?: Record<string, unknown> | null;
  total: number;
};
