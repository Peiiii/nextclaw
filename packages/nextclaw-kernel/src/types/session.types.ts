import type { CreateSessionContextInheritanceInput } from "@nextclaw/core";
import type { NcpMessage, NcpSessionMessagePageInfo, NcpSessionSummary } from "@nextclaw/ncp";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import type { NcpAgentSessionJournalReplayEvent } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import type { UnfinishedNcpAgentRun } from "@kernel/utils/ncp-agent-unfinished-run.utils.js";
import type { ThinkingEffort } from "@kernel/types/agent-run.types.js";

export type SessionMetadataUpdate = {
  sessionId: string;
  metadata: Record<string, unknown>;
  expectedMetadata?: Record<string, unknown>;
};

/** Storage operations consumed by the shared session owner, independent of local files. */
export interface SessionPersistence {
  appendSessionEvent(params: {
    sessionId: string;
    event: NcpAgentSessionJournalReplayEvent;
  }): Promise<void>;
  importSessionSnapshot(record: AgentSessionRecord): Promise<void>;
  getSession(sessionId: string): Promise<AgentSessionRecord | null>;
  deleteSession(sessionId: string): Promise<AgentSessionRecord | null>;
  getSessionSummary(sessionId: string): Promise<NcpSessionSummary | null>;
  listSessionSummaries(options?: { limit?: number }): Promise<NcpSessionSummary[]>;
  listSessionSummaryPage(options: {
    page: number;
    pageSize: number;
    query?: string;
  }): Promise<{ sessions: NcpSessionSummary[]; total: number }>;
  listSessionMessages(sessionId: string): Promise<NcpMessage[]>;
  listSessionMessagePage(params: {
    sessionId: string;
    limit: number;
    cursor?: string;
  }): Promise<SessionMessagePage | null>;
  setSessionMetadata(params: {
    sessionId: string;
    metadata: Record<string, unknown>;
  }): Promise<boolean>;
  updateSessionMetadata(params: SessionMetadataUpdate): Promise<boolean>;
  synchronizeSessionMessageProjection(sessionId: string): Promise<boolean>;
  getSessionMessageProjectionContextWindow(sessionId: string): Promise<Record<string, unknown> | null>;
  updateSessionMessageProjectionContextWindow(
    sessionId: string,
    contextWindow: Record<string, unknown> | null,
  ): Promise<void>;
  listUnfinishedRuns(): Promise<UnfinishedNcpAgentRun[]>;
}

export type SessionMessagePage = {
  messages: NcpMessage[];
  messageDetailCursors: Record<string, string>;
  total: number;
  pageInfo: NcpSessionMessagePageInfo;
  contextWindow: Record<string, unknown> | null;
};

export type SessionTokenUsageStatus = "reported" | "partial" | "unavailable";

export type SessionTokenUsageTotals = {
  inputTokens: number | null;
  outputTokens: number | null;
  cachedInputTokens: number | null;
  totalTokens: number | null;
  cacheHitRate: number | null;
};

export type SessionModelTokenUsage = SessionTokenUsageTotals & {
  model: string;
  runCount: number;
  modelCallCount: number | null;
  reportedModelCallCount: number | null;
  status: SessionTokenUsageStatus;
};

export type SessionTokenUsageSummary = {
  sessionId: string;
  totals: SessionTokenUsageTotals;
  models: SessionModelTokenUsage[];
  runCount: number;
  modelCallCount: number | null;
  reportedModelCallCount: number | null;
  status: SessionTokenUsageStatus;
};

export class SessionMessageCursorError extends Error {
  constructor(message = "Invalid session message cursor.") {
    super(message);
    this.name = "SessionMessageCursorError";
  }
}

export function isSessionMessageCursorError(
  error: unknown,
): error is SessionMessageCursorError {
  return error instanceof SessionMessageCursorError;
}

export type AgentRunSession = {
  sessionId: string;
  agentId?: string;
  agentRuntimeId: string;
  metadata: Record<string, unknown>;
  model?: string;
  projectRoot?: string;
  projectId?: string;
  workingDir: string;
  thinkingEffort?: ThinkingEffort | null;
};

export type CreateAgentRunSessionParams = {
  sessionId?: string;
  peerId?: string;
  agentId?: string;
  agentRuntimeId?: string;
  channel?: string;
  metadata?: Record<string, unknown>;
  model?: string;
  parentSessionId?: string;
  projectRoot?: string;
  sourceSessionId?: string;
  sourceSessionMetadata?: Record<string, unknown>;
  contextInheritance?: CreateSessionContextInheritanceInput;
  task?: string;
  thinkingEffort?: ThinkingEffort | null;
};

export type SessionSettingsPatch = {
  pinned?: boolean;
  /** Import a legacy pin only when no server-side pin choice exists. */
  pinnedIfUnset?: boolean;
  label?: string | null;
  preferredModel?: string | null;
  preferredThinking?: string | null;
  sessionType?: string | null;
  projectRoot?: string | null;
  uiReadAt?: string | null;
};

export class SessionSettingsError extends Error {
  constructor(
    readonly code: "PREFERRED_THINKING_INVALID" | "PINNED_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "SessionSettingsError";
  }
}

export function isSessionSettingsError(
  error: unknown,
): error is SessionSettingsError {
  return error instanceof SessionSettingsError;
}
