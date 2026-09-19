import { open } from "node:fs/promises";
import { createInterface } from "node:readline";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import { scanSessionJournal } from "@kernel/utils/ncp-agent-session-journal-entry.utils.js";
import { SessionEventReplayer } from "@kernel/utils/ncp-agent-session-replay.utils.js";
import { readReplayToolOwners, seedReplayToolOwners } from "@kernel/utils/ncp-agent-session-replay-tool-ownership.utils.js";
import {
  SessionReplaySupersessionTracker,
  readEventMessageId,
  readEventToolCallId,
} from "@kernel/utils/ncp-agent-session-replay-event.utils.js";
import { isRecord } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import type { NcpAgentSessionMessageProjectionMeta } from "@kernel/utils/ncp-agent-session-message-projection.utils.js";

const TOOL_CALL_START_EVENT_NEEDLE = `"type":"${NcpEventType.MessageToolCallStart}"`;

export async function readNcpAgentSessionProjectionTail(
  journalPath: string,
  meta: NcpAgentSessionMessageProjectionMeta,
  readMessage: (messageId: string) => Promise<NcpMessage | null>,
): Promise<NcpMessage[]> {
  const file = await open(journalPath, "r");
  try {
    const { size } = await file.stat();
    const offset = meta.projectedJournalOffset;
    if (offset < 0 || offset >= size) return [];
    const seedIds = new Set(meta.pendingCompactionMessageIds);
    if (meta.activeMessageId) seedIds.add(meta.activeMessageId);
    const initialSeeds = (await Promise.all([...seedIds].map(readMessage)))
      .filter((message): message is NcpMessage => Boolean(message));
    const toolOwners = seedReplayToolOwners(initialSeeds);
    const missingToolCallIds = new Set<string>();
    const supersessionTracker = new SessionReplaySupersessionTracker();
    await scanSessionJournal({
      path: journalPath,
      startOffset: offset,
      endOffset: size,
      onEvent: (event, eventIndex) => {
        supersessionTracker.observe(event, eventIndex);
        const toolCallId = readEventToolCallId(event);
        if (toolCallId && !readEventMessageId(event) && !toolOwners.has(toolCallId)) {
          missingToolCallIds.add(toolCallId);
        }
        for (const [callId, messageId] of readReplayToolOwners(event)) toolOwners.set(callId, messageId);
      if (event.type === NcpEventType.RunFinished || event.type === NcpEventType.RunError || event.type === NcpEventType.RunMetadata || event.type === NcpEventType.MessageAbort) {
        const messageId = readEventMessageId(event);
        if (messageId) seedIds.add(messageId);
      }
      },
    });
    let seeds = (await Promise.all([...seedIds].map(readMessage)))
      .filter((message): message is NcpMessage => Boolean(message));
    if (missingToolCallIds.size > 0) {
      const historicalOwners = await readHistoricalToolOwners(
        file,
        offset,
        missingToolCallIds,
      );
      const ownerMessageIds = new Set(historicalOwners.values());
      const ownerSeeds = (await Promise.all([...ownerMessageIds].map(readMessage)))
        .filter((message): message is NcpMessage => Boolean(message));
      seeds = deduplicateMessages([...seeds, ...ownerSeeds]);
      const unresolvedToolCallIds = [...missingToolCallIds].filter((toolCallId) => {
        const ownerMessageId = historicalOwners.get(toolCallId);
        return !ownerMessageId || !seeds.some((message) => message.id === ownerMessageId);
      });
      if (unresolvedToolCallIds.length > 0) {
        console.warn("[ncp-agent-session-journal] unresolved historical tool owners", {
          sessionId: meta.sessionId,
          toolCallIds: unresolvedToolCallIds,
          fallback: "ignore-unowned-tail-events",
        });
      }
    }
    const replayer = await SessionEventReplayer.create(seeds, meta.activeMessageId, false);
    const supersededSyntheticRecoveryIndexes = supersessionTracker.finish();
    await scanSessionJournal({
      path: journalPath,
      startOffset: offset,
      endOffset: size,
      onEvent: async (event, eventIndex) => {
        await replayer.append(event, eventIndex, supersededSyntheticRecoveryIndexes);
      },
    });
    return replayer.finish();
  } finally {
    await file.close();
  }
}

async function readHistoricalToolOwners(
  file: Awaited<ReturnType<typeof open>>,
  endOffset: number,
  targetToolCallIds: ReadonlySet<string>,
): Promise<Map<string, string>> {
  const owners = new Map<string, string>();
  if (endOffset <= 0 || targetToolCallIds.size === 0) return owners;
  const stream = file.createReadStream({
    start: 0,
    end: endOffset - 1,
    encoding: "utf-8",
    autoClose: false,
  });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (!line.includes(TOOL_CALL_START_EVENT_NEEDLE)) continue;
      const owner = readToolCallOwner(line);
      if (!owner || !targetToolCallIds.has(owner.toolCallId)) continue;
      owners.set(owner.toolCallId, owner.messageId);
      if (owners.size === targetToolCallIds.size) break;
    }
    return owners;
  } finally {
    lines.close();
    stream.destroy();
  }
}

function readToolCallOwner(line: string): { toolCallId: string; messageId: string } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !isRecord(parsed.event) || parsed.event.type !== NcpEventType.MessageToolCallStart) {
    return null;
  }
  const payload = isRecord(parsed.event.payload) ? parsed.event.payload : null;
  const toolCallId = typeof payload?.toolCallId === "string" ? payload.toolCallId.trim() : "";
  const messageId = typeof payload?.messageId === "string" ? payload.messageId.trim() : "";
  return toolCallId && messageId ? { toolCallId, messageId } : null;
}

function deduplicateMessages(messages: readonly NcpMessage[]): NcpMessage[] {
  return [...new Map(messages.map((message) => [message.id, message])).values()];
}
