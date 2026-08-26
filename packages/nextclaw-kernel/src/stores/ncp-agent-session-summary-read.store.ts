import type { NcpSessionSummary } from "@nextclaw/ncp";
import { createNcpAgentSessionSummary, readNcpAgentSessionPeerId } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import type { NcpAgentSessionActivitySnapshot } from "@kernel/stores/ncp-agent-session-metadata.store.js";

const METADATA_READ_CONCURRENCY = 2;

type SessionSummaryReadStoreOptions = {
  getIndexedSummary: (sessionId: string) => Promise<NcpSessionSummary | null>;
  listIndexedSummaries: (limit?: number) => Promise<NcpSessionSummary[]>;
  readJournalModifiedAt: (sessionId: string) => Promise<string>;
  readMetadata: (
    sessionId: string,
    fallback: NcpAgentSessionActivitySnapshot,
  ) => Promise<NcpAgentSessionActivitySnapshot>;
  readProjectedMessageCount: (sessionId: string) => Promise<number | null>;
};

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  project: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(METADATA_READ_CONCURRENCY, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        results[index] = await project(values[index]!);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export class NcpAgentSessionSummaryReadStore {
  constructor(private readonly options: SessionSummaryReadStoreOptions) {}

  list = async (limit?: number): Promise<NcpSessionSummary[]> => {
    const normalizedLimit = limit === undefined || limit === Number.POSITIVE_INFINITY
      ? undefined
      : Math.max(0, Math.trunc(limit));
    const summaries = await this.options.listIndexedSummaries(normalizedLimit);
    const selected = normalizedLimit === undefined
      ? summaries
      : summaries.slice(0, normalizedLimit);
    return await mapWithConcurrency(selected, this.withMetadata);
  };

  get = async (sessionId: string): Promise<NcpSessionSummary | null> => {
    const indexed = await this.options.getIndexedSummary(sessionId);
    if (indexed) return await this.withMetadata(indexed);
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

  private withMetadata = async (
    summary: NcpSessionSummary,
  ): Promise<NcpSessionSummary> => {
    const snapshot = await this.options.readMetadata(summary.sessionId, {
      ...(summary.agentId ? { agentId: summary.agentId } : {}),
      createdAt: summary.createdAt ?? summary.updatedAt,
      updatedAt: summary.updatedAt,
      metadata: {},
    });
    const peerId = summary.peerId ?? readNcpAgentSessionPeerId(snapshot.metadata);
    return {
      ...summary,
      peerId: peerId ?? undefined,
      ...(!summary.agentId && snapshot.agentId ? { agentId: snapshot.agentId } : {}),
      ...(Object.keys(snapshot.metadata).length > 0 ? { metadata: snapshot.metadata } : {}),
    };
  };
}
