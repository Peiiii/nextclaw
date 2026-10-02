import type { NcpSessionSummary } from "@nextclaw/ncp";
import type { SessionListFilter, SessionListPageOptions } from "@kernel/types/session.types.js";
import { createNcpAgentSessionSummary } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import type { NcpAgentSessionActivitySnapshot } from "@kernel/stores/ncp-agent-session-metadata.store.js";

type SessionSummaryReadStoreOptions = {
  summaryIndex: {
    get: (sessionId: string) => Promise<NcpSessionSummary | null>;
    list: (limit?: number) => Promise<NcpSessionSummary[]>;
    listPage: (options: SessionListFilter & { offset: number; limit: number }) => Promise<NcpSessionSummary[]>;
    count: (options: SessionListFilter) => Promise<number>;
  };
  readJournalModifiedAt: (sessionId: string) => Promise<string>;
  readMetadata: (
    sessionId: string,
    fallback: NcpAgentSessionActivitySnapshot,
  ) => Promise<NcpAgentSessionActivitySnapshot>;
  readProjectedMessageCount: (sessionId: string) => Promise<number | null>;
};

export class NcpAgentSessionSummaryReadStore {
  constructor(private readonly options: SessionSummaryReadStoreOptions) {}

  list = async (limit?: number): Promise<NcpSessionSummary[]> => {
    const normalizedLimit = limit === undefined || limit === Number.POSITIVE_INFINITY
      ? undefined
      : Math.max(0, Math.trunc(limit));
    const summaries = await this.options.summaryIndex.list(normalizedLimit);
    const selected = normalizedLimit === undefined
      ? summaries
      : summaries.slice(0, normalizedLimit);
    return selected;
  };

  listPage = async (options: SessionListPageOptions): Promise<{ sessions: NcpSessionSummary[]; total: number }> => {
    const { page: requestedPage, pageSize: requestedPageSize, ...filter } = options;
    const page = Math.max(1, Math.trunc(requestedPage));
    const pageSize = Math.max(1, Math.trunc(requestedPageSize));
    const [summaries, total] = await Promise.all([
      this.options.summaryIndex.listPage({
        ...filter,
        offset: (page - 1) * pageSize,
        limit: pageSize,
      }),
      this.options.summaryIndex.count(filter),
    ]);
    return { sessions: summaries, total };
  };

  get = async (sessionId: string): Promise<NcpSessionSummary | null> => {
    const indexed = await this.options.summaryIndex.get(sessionId);
    if (indexed) return indexed;
    const messageCount = await this.options.readProjectedMessageCount(sessionId);
    if (messageCount === null) return null;
    const updatedAt = await this.options.readJournalModifiedAt(sessionId);
    const snapshot = await this.options.readMetadata(sessionId, {
      createdAt: updatedAt,
      updatedAt,
      metadata: {},
    });
    return {
      ...createNcpAgentSessionSummary({
        sessionId,
        ...(snapshot.agentId ? { agentId: snapshot.agentId } : {}),
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
        metadata: snapshot.metadata,
        messages: [],
      }),
      messageCount,
    };
  };

}
