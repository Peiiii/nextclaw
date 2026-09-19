import { NcpEventType } from "@nextclaw/ncp";
import { open } from "node:fs/promises";
import { createInterface } from "node:readline";
import {
  isRecord,
  NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE,
  type NcpAgentSessionJournalEventEntry,
  type NcpAgentSessionJournalReplayEvent,
  normalizeNcpAgentId,
  toIsoString
} from "./ncp-agent-session-journal.utils.js";

export type ParsedNcpAgentSessionJournal = {
  metadata: Record<string, unknown>;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
  nextSeq: number;
  projectedJournalOffset: number;
  events: NcpAgentSessionJournalReplayEvent[];
};

export function isNcpAgentSessionMessageProjectionBoundaryEvent(event: NcpAgentSessionJournalReplayEvent): boolean {
  return (
    event.type === NcpEventType.MessageSent ||
    event.type === NcpEventType.MessageCompleted ||
    event.type === NcpEventType.MessageAbort ||
    event.type === NcpEventType.RunFinished ||
    event.type === NcpEventType.RunError ||
    event.type === NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE
  );
}

export function serializeNcpAgentSessionJournalEntry(entry: NcpAgentSessionJournalEventEntry): string {
  const serialized = JSON.stringify(entry);
  if (!serialized) {
    throw new Error("ncp agent session journal entry serialization produced empty output");
  }
  const parsed = JSON.parse(serialized) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("ncp agent session journal entry serialization produced a non-object entry");
  }
  return serialized;
}

export function attachNcpAgentSessionJournalTimestamp(
  event: NcpAgentSessionJournalReplayEvent,
  timestamp: string
): NcpAgentSessionJournalReplayEvent {
  if (!("payload" in event) || !isRecord(event.payload)) {
    return event;
  }
  return {
    ...event,
    payload: {
      ...event.payload,
      timestamp
    }
  } as unknown as NcpAgentSessionJournalReplayEvent;
}

export class NcpAgentSessionJournalParser {
  private metadata: Record<string, unknown> = {};
  private agentId: string | undefined;
  private createdAt = new Date().toISOString();
  private updatedAt = this.createdAt;
  private nextSeq = 1;
  private projectedJournalOffset = 0;
  private readonly events: NcpAgentSessionJournalReplayEvent[] = [];

  constructor(private readonly collectEvents = true) {}

  append = (line: string, index: number, lineEndOffset: number): NcpAgentSessionJournalReplayEvent | null => {
    if (!line.trim()) {
      return null;
    }
    const parsed = this.parseLine(line, index);
    if (!parsed) {
      return null;
    }
    if (parsed._type === "metadata") {
      this.applyMetadata(parsed);
      return null;
    }
    if (parsed._type === "event" && isRecord(parsed.event)) {
      return this.applyEvent(parsed, lineEndOffset);
    }
    return null;
  };

  finish = (): ParsedNcpAgentSessionJournal => ({
    metadata: this.metadata,
    ...(this.agentId ? { agentId: this.agentId } : {}),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    nextSeq: this.nextSeq,
    projectedJournalOffset: this.projectedJournalOffset,
    events: this.events
  });

  private parseLine = (line: string, index: number): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(line) as unknown;
      return isRecord(parsed) ? parsed : null;
    } catch (error) {
      console.warn(
        `[ncp-agent-session-journal] skipped corrupted journal line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  };

  private applyMetadata = (entry: Record<string, unknown>): void => {
    this.metadata = isRecord(entry.metadata) ? structuredClone(entry.metadata) : {};
    this.agentId = normalizeNcpAgentId(typeof entry.agent_id === "string" ? entry.agent_id : undefined);
    this.createdAt = toIsoString(entry.created_at, this.createdAt);
    this.updatedAt = toIsoString(entry.updated_at, this.updatedAt);
  };

  private applyEvent = (entry: Record<string, unknown>, lineEndOffset: number): NcpAgentSessionJournalReplayEvent => {
    const seq = Number(entry.seq);
    this.nextSeq = Math.max(this.nextSeq, Number.isFinite(seq) ? Math.trunc(seq) + 1 : this.nextSeq);
    const eventTimestamp = toIsoString(entry.timestamp, this.updatedAt);
    this.updatedAt = eventTimestamp;
    const event = structuredClone(entry.event) as NcpAgentSessionJournalReplayEvent;
    const replayEvent = attachNcpAgentSessionJournalTimestamp(event, eventTimestamp);
    if (this.collectEvents) this.events.push(replayEvent);
    if (isNcpAgentSessionMessageProjectionBoundaryEvent(replayEvent)) {
      this.projectedJournalOffset = lineEndOffset;
    }
    return replayEvent;
  };
}

export function parseNcpAgentSessionJournal(raw: string): ParsedNcpAgentSessionJournal {
  const parser = new NcpAgentSessionJournalParser();
  let byteOffset = 0;
  const lines = raw.split("\n");
  for (const [index, line] of lines.entries()) {
    const lineEndOffset = byteOffset + Buffer.byteLength(line, "utf-8") + (index < lines.length - 1 ? 1 : 0);
    parser.append(line, index, lineEndOffset);
    byteOffset = lineEndOffset;
  }
  return parser.finish();
}

export async function scanSessionJournal(params: {
  path: string;
  startOffset?: number;
  endOffset: number;
  onEvent?: (event: NcpAgentSessionJournalReplayEvent, eventIndex: number) => Promise<void> | void;
}): Promise<ParsedNcpAgentSessionJournal> {
  const { endOffset, onEvent, path } = params;
  const startOffset = Math.max(0, params.startOffset ?? 0);
  const parser = new NcpAgentSessionJournalParser(false);
  if (endOffset <= startOffset) return parser.finish();
  const file = await open(path, "r");
  const stream = file.createReadStream({
    start: startOffset,
    end: endOffset - 1,
    encoding: "utf-8",
    autoClose: false,
  });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let lineIndex = 0;
  let byteOffset = startOffset;
  try {
    for await (const line of lines) {
      const lineEndOffset = Math.min(
        endOffset,
        byteOffset + Buffer.byteLength(line, "utf-8") + 1,
      );
      const event = parser.append(line, lineIndex, lineEndOffset);
      if (event) await onEvent?.(event, lineIndex);
      byteOffset = lineEndOffset;
      lineIndex += 1;
    }
    return parser.finish();
  } finally {
    lines.close();
    stream.destroy();
    await file.close();
  }
}
