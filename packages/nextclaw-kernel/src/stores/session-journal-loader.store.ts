import { open, stat } from "node:fs/promises";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import type { LoadedNcpAgentJournalSession } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import { scanSessionJournal } from "@kernel/utils/ncp-agent-session-journal-entry.utils.js";
import { SessionEventReplayer } from "@kernel/utils/ncp-agent-session-replay.utils.js";
import { SessionReplaySupersessionTracker } from "@kernel/utils/ncp-agent-session-replay-event.utils.js";
import type { NcpAgentSessionMetadataStore } from "./ncp-agent-session-metadata.store.js";
import type { NcpAgentSessionMessageProjectionStore } from "./ncp-agent-session-message-projection.store.js";

export class SessionJournalLoaderStore {
  constructor(
    private readonly metadataStore: NcpAgentSessionMetadataStore,
    private readonly messageProjectionStore: NcpAgentSessionMessageProjectionStore,
  ) {}

  load = async (sessionId: string, path: string): Promise<LoadedNcpAgentJournalSession | null> => {
    let journalStat: Awaited<ReturnType<typeof stat>>;
    try {
      journalStat = await stat(path);
    } catch {
      return null;
    }
    const projected = await this.messageProjectionStore.readAllSnapshot(sessionId);
    if (projected) {
      const journalTail = await this.readLastJournalState(path, journalStat.size);
      const sessionMetadata = await this.metadataStore.read(sessionId, {
        metadata: {},
        createdAt: journalStat.birthtime.toISOString(),
        updatedAt: journalTail.updatedAt ?? journalStat.mtime.toISOString(),
      });
      const { agentId, createdAt, updatedAt, metadata } = sessionMetadata;
      return {
        record: {
          sessionId,
          ...(agentId ? { agentId } : {}),
          messages: projected.messages,
          createdAt,
          updatedAt,
          metadata,
        },
        nextSeq: journalTail.nextSeq,
        journalOffset: journalStat.size,
        projectedJournalOffset: projected.meta.projectedJournalOffset,
      };
    }
    return await this.loadFromJournalStream(sessionId, path, journalStat.size);
  };

  private loadFromJournalStream = async (
    sessionId: string,
    path: string,
    journalOffset: number,
  ): Promise<LoadedNcpAgentJournalSession> => {
    const supersessionTracker = new SessionReplaySupersessionTracker();
    const parsedJournal = await scanSessionJournal({
      path,
      endOffset: journalOffset,
      onEvent: (event, eventIndex) => supersessionTracker.observe(event, eventIndex),
    });
    const sessionMetadata = await this.metadataStore.read(sessionId, parsedJournal);
    const { agentId, createdAt, updatedAt, metadata } = sessionMetadata;
    const replayer = await SessionEventReplayer.create();
    const supersededSyntheticRecoveryIndexes = supersessionTracker.finish();
    await scanSessionJournal({
      path,
      endOffset: journalOffset,
      onEvent: async (event, eventIndex) => {
        await replayer.append(event, eventIndex, supersededSyntheticRecoveryIndexes);
      },
    });
    const record: AgentSessionRecord = {
      sessionId,
      ...(agentId ? { agentId } : {}),
      messages: replayer.finish(),
      createdAt,
      updatedAt,
      metadata,
    };
    return {
      record,
      nextSeq: parsedJournal.nextSeq,
      journalOffset,
      projectedJournalOffset: parsedJournal.projectedJournalOffset,
    };
  };

  private readLastJournalState = async (
    path: string,
    size: number,
  ): Promise<{ nextSeq: number; updatedAt: string | null }> => {
    if (size <= 0) return { nextSeq: 1, updatedAt: null };
    const file = await open(path, "r");
    const chunkBytes = 64 * 1024;
    let position = size;
    let suffix = Buffer.alloc(0);
    try {
      while (position > 0) {
        const start = Math.max(0, position - chunkBytes);
        const chunk = Buffer.alloc(position - start);
        const { bytesRead } = await file.read(chunk, 0, chunk.length, start);
        const data = Buffer.concat([chunk.subarray(0, bytesRead), suffix]);
        let lineEnd = data.length;
        for (;;) {
          const newline = data.lastIndexOf(0x0a, lineEnd - 1);
          if (newline < 0) break;
          const state = this.readStateFromJournalLine(data.subarray(newline + 1, lineEnd));
          if (state) return state;
          lineEnd = newline;
        }
        suffix = data.subarray(0, lineEnd);
        position = start;
      }
      return this.readStateFromJournalLine(suffix) ?? { nextSeq: 1, updatedAt: null };
    } finally {
      await file.close();
    }
  };

  private readStateFromJournalLine = (
    line: Buffer,
  ): { nextSeq: number; updatedAt: string | null } | null => {
    if (line.length === 0) return null;
    try {
      const entry = JSON.parse(line.toString("utf-8")) as {
        _type?: unknown;
        seq?: unknown;
        timestamp?: unknown;
      };
      const seq = Number(entry._type === "event" ? entry.seq : NaN);
      if (!Number.isFinite(seq)) return null;
      const updatedAt = typeof entry.timestamp === "string" && Number.isFinite(Date.parse(entry.timestamp))
        ? new Date(entry.timestamp).toISOString()
        : null;
      return { nextSeq: Math.trunc(seq) + 1, updatedAt };
    } catch {
      return null;
    }
  };
}
