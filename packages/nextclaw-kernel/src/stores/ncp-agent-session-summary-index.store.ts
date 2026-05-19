import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { AgentSessionEventRecord } from "@nextclaw/ncp-toolkit";
import type { NcpSessionSummary } from "@nextclaw/ncp";
import {
  createNcpAgentSessionSummary,
  type LoadedNcpAgentJournalSession,
  NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION,
  NCP_AGENT_SESSION_JOURNAL_INDEX_FILE,
  type NcpAgentSessionJournalIndex,
  type NcpAgentSessionJournalReplayEvent,
  readNcpSessionSummaryActivityAt,
  upsertNcpAgentSessionSummaryEvent,
} from "@kernel/utils/ncp-agent-session-journal.utils.js";

export class NcpAgentSessionSummaryIndexStore {
  private summaryIndex: Map<string, NcpSessionSummary> | null = null;

  constructor(
    private readonly journalDir: string,
    private readonly loadSession: (sessionId: string) => Promise<LoadedNcpAgentJournalSession | null>,
  ) {}

  has = async (sessionId: string): Promise<boolean> => (await this.load()).has(sessionId);

  list = async (): Promise<NcpSessionSummary[]> => {
    const index = await this.load();
    return [...index.values()]
      .map((summary) => structuredClone(summary))
      .sort((left, right) => readNcpSessionSummaryActivityAt(right).localeCompare(readNcpSessionSummaryActivityAt(left)));
  };

  upsert = async (summary: NcpSessionSummary): Promise<void> => {
    const index = await this.load();
    index.set(summary.sessionId, structuredClone(summary));
    await this.persist();
  };

  upsertForEvent = async (params: {
    session: AgentSessionEventRecord;
    event: NcpAgentSessionJournalReplayEvent;
    updatedAt: string;
  }): Promise<void> => {
    const { event, session, updatedAt } = params;
    const index = await this.load();
    const summary = upsertNcpAgentSessionSummaryEvent({
      current: index.get(session.sessionId),
      session,
      event,
      updatedAt,
    });
    index.set(summary.sessionId, summary);
    await this.persist();
  };

  remove = async (sessionId: string): Promise<void> => {
    const index = await this.load();
    index.delete(sessionId);
    await this.persist();
  };

  private load = async (): Promise<Map<string, NcpSessionSummary>> => {
    if (this.summaryIndex) {
      return this.summaryIndex;
    }
    try {
      const parsed = JSON.parse(await readFile(this.indexPath(), "utf-8")) as NcpAgentSessionJournalIndex;
      if (parsed.version === NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION && Array.isArray(parsed.records)) {
        this.summaryIndex = new Map(parsed.records.map((record) => [record.sessionId, structuredClone(record)]));
        return this.summaryIndex;
      }
    } catch {
      // Rebuild below.
    }
    this.summaryIndex = await this.rebuild();
    await this.persist();
    return this.summaryIndex;
  };

  private rebuild = async (): Promise<Map<string, NcpSessionSummary>> => {
    const records = new Map<string, NcpSessionSummary>();
    let entries: string[] = [];
    try {
      entries = await readdir(this.journalDir);
    } catch {
      return records;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".jsonl")) {
        continue;
      }
      const sessionId = entry.replace(/\.jsonl$/, "").replace(/_/g, ":");
      const loaded = await this.loadSession(sessionId);
      if (loaded) {
        records.set(sessionId, createNcpAgentSessionSummary(loaded.record));
      }
    }
    return records;
  };

  private persist = async (): Promise<void> => {
    const records = [...(this.summaryIndex?.values() ?? [])]
      .map((summary) => structuredClone(summary))
      .sort((left, right) => readNcpSessionSummaryActivityAt(right).localeCompare(readNcpSessionSummaryActivityAt(left)));
    await mkdir(this.journalDir, { recursive: true });
    await writeFile(
      this.indexPath(),
      `${JSON.stringify({ version: NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION, records })}\n`,
      "utf-8",
    );
  };

  private indexPath = (): string => resolve(this.journalDir, NCP_AGENT_SESSION_JOURNAL_INDEX_FILE);
}
