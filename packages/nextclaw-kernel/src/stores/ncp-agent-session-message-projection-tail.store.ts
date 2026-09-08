import { open } from "node:fs/promises";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import { parseNcpAgentSessionJournal } from "@kernel/utils/ncp-agent-session-journal-entry.utils.js";
import { replayNcpAgentSessionEvents } from "@kernel/utils/ncp-agent-session-replay.utils.js";
import { needsReplayToolHistory } from "@kernel/utils/ncp-agent-session-replay-tool-ownership.utils.js";
import { readEventMessageId } from "@kernel/utils/ncp-agent-session-replay-event.utils.js";
import type { NcpAgentSessionMessageProjectionMeta } from "@kernel/utils/ncp-agent-session-message-projection.utils.js";

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
    const buffer = Buffer.alloc(size - offset);
    const result = await file.read(buffer, 0, buffer.length, offset);
    const journal = parseNcpAgentSessionJournal(buffer.subarray(0, result.bytesRead).toString("utf-8"));
    const seedIds = new Set(meta.pendingCompactionMessageIds);
    if (meta.activeMessageId) seedIds.add(meta.activeMessageId);
    for (const event of journal.events) {
      if (event.type === NcpEventType.RunFinished || event.type === NcpEventType.RunError || event.type === NcpEventType.RunMetadata || event.type === NcpEventType.MessageAbort) {
        const messageId = readEventMessageId(event);
        if (messageId) seedIds.add(messageId);
      }
    }
    const seeds = (await Promise.all([...seedIds].map(readMessage)))
      .filter((message): message is NcpMessage => Boolean(message));
    if (needsReplayToolHistory(journal.events, seeds)) {
      // Use the same file and prefix as the tail, even if another append occurs.
      const prefix = Buffer.alloc(size);
      const full = await file.read(prefix, 0, size, 0);
      return await replayNcpAgentSessionEvents(parseNcpAgentSessionJournal(prefix.subarray(0, full.bytesRead).toString("utf-8")).events);
    }
    return await replayNcpAgentSessionEvents(journal.events, seeds, meta.activeMessageId, false);
  } finally {
    await file.close();
  }
}
