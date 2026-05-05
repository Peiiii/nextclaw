import type { NcpMessage, NcpSessionStatus, NcpSessionSummary } from '@nextclaw/ncp';
import type { ThinkingLevel } from './types';

export type SessionTypeIconView = {
  kind: "image";
  src: string;
  alt?: string | null;
};

export type RuntimeEntryView = {
  enabled?: boolean;
  label?: string;
  icon?: SessionTypeIconView | null;
  type: string;
  config?: Record<string, unknown>;
};

export type SessionContextWindowView = {
  usedContextTokens: number;
  totalContextTokens: number;
  prunedUsedContextTokens: number;
  availableContextTokens: number;
  droppedHistoryCount: number;
  truncatedToolResultCount: number;
  truncatedSystemPrompt: boolean;
  truncatedUserMessage: boolean;
  compacted: boolean;
  checkpointId?: string;
  compactedMessageCount: number;
  compactedUsedContextTokens?: number;
  updatedAt: string;
};

export type SessionEntryView = {
  key: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  readAt?: string;
  agentId?: string;
  label?: string;
  channel?: string;
  type?: string;
  preferredModel?: string;
  preferredThinking?: ThinkingLevel | null;
  projectRoot?: string | null;
  projectName?: string | null;
  sessionType: string;
  sessionTypeMutable: boolean;
  isChildSession?: boolean;
  isPromotedChildSession?: boolean;
  parentSessionId?: string | null;
  spawnedByRequestId?: string | null;
  contextWindow?: SessionContextWindowView | null;
  messageCount: number;
  lastRole?: string;
  lastTimestamp?: string;
};

export type SessionMessageView = {
  role: string;
  content: unknown;
  timestamp: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<Record<string, unknown>>;
  reasoning_content?: string;
};

export type SessionEventView = {
  seq: number;
  type: string;
  timestamp: string;
  message?: SessionMessageView;
};

export type NcpSessionSummaryView = NcpSessionSummary;

export type NcpSessionsListView = {
  sessions: NcpSessionSummaryView[];
  total: number;
};

export type NcpMessageView = NcpMessage;

export type NcpSessionMessagesView = {
  sessionId: string;
  status: NcpSessionStatus;
  messages: NcpMessageView[];
  total: number;
};
