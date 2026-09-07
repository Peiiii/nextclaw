import type { NcpSessionSummary } from "@nextclaw/ncp";
import { createNcpAgentSessionSummary } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import type { NcpAgentSessionActivitySnapshot } from "@kernel/stores/ncp-agent-session-metadata.store.js";

type SessionSummaryReadStoreOptions = {
  summaryIndex: {
    get: (sessionId: string) => Promise<NcpSessionSummary | null>;
    list: (limit?: number) => Promise<NcpSessionSummary[]>;
    listPage: (options: { offset: number; limit: number; query?: string }) => Promise<NcpSessionSummary[]>;
    count: (query?: string) => Promise<number>;
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

  listPage = async (options: {
    page: number;
    pageSize: number;
    query?: string;
  }): Promise<{ sessions: NcpSessionSummary[]; total: number }> => {
    const page = Math.max(1, Math.trunc(options.page));
    const pageSize = Math.max(1, Math.trunc(options.pageSize));
    const [summaries, total] = await Promise.all([
      this.options.summaryIndex.listPage({
        offset: (page - 1) * pageSize,
        limit: pageSize,
        ...(options.query?.trim() ? { query: options.query.trim() } : {}),
      }),
      this.options.summaryIndex.count(options.query),
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
