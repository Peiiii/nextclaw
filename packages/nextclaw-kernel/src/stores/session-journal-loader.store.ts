import { stat } from "node:fs/promises";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import type { LoadedNcpAgentJournalSession } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import { scanSessionJournal } from "@kernel/utils/ncp-agent-session-journal-entry.utils.js";
import { SessionEventReplayer } from "@kernel/utils/ncp-agent-session-replay.utils.js";
import { SessionReplaySupersessionTracker } from "@kernel/utils/ncp-agent-session-replay-event.utils.js";
import type { NcpAgentSessionMetadataStore } from "./ncp-agent-session-metadata.store.js";

/** Explicit full-record operations read the source, never the bounded display projection. */
export class SessionJournalLoaderStore {
  constructor(private readonly metadataStore: NcpAgentSessionMetadataStore) {}

  load = async (sessionId: string, path: string): Promise<LoadedNcpAgentJournalSession | null> => {
    let journalStat: Awaited<ReturnType<typeof stat>>;
    try { journalStat = await stat(path); } catch { return null; }
    const journalOffset = journalStat.size;
    const supersessionTracker = new SessionReplaySupersessionTracker();
    const parsedJournal = await scanSessionJournal({
      path, endOffset: journalOffset,
      onEvent: (event, eventIndex) => supersessionTracker.observe(event, eventIndex),
    });
    const { agentId, createdAt, updatedAt, metadata } = await this.metadataStore.read(sessionId, {
      ...parsedJournal,
      createdAt: Date.parse(parsedJournal.createdAt) > journalStat.birthtimeMs ? journalStat.birthtime.toISOString() : parsedJournal.createdAt,
      updatedAt: Date.parse(parsedJournal.updatedAt) > journalStat.mtimeMs ? parsedJournal.updatedAt : journalStat.mtime.toISOString(),
    });
    const replayer = await SessionEventReplayer.create();
    const supersededSyntheticRecoveryIndexes = supersessionTracker.finish();
    await scanSessionJournal({ path, endOffset: journalOffset, onEvent: async (event, eventIndex) => {
      await replayer.append(event, eventIndex, supersededSyntheticRecoveryIndexes);
    } });
    const record: AgentSessionRecord = { sessionId, ...(agentId ? { agentId } : {}), messages: replayer.finish(), createdAt, updatedAt, metadata };
    return { record, nextSeq: parsedJournal.nextSeq, journalOffset, projectedJournalOffset: parsedJournal.projectedJournalOffset };
  };
}
