import { NcpEventType } from "@nextclaw/ncp";
import type { NcpAgentSessionJournalReplayEvent } from "./ncp-agent-session-journal.utils.js";

export type UnfinishedNcpAgentRun = {
  sessionId: string;
  messageId?: string;
  runId?: string;
  startedAt?: string;
};

export function readUnfinishedNcpAgentRun(
  sessionId: string,
  events: readonly NcpAgentSessionJournalReplayEvent[],
): UnfinishedNcpAgentRun | null {
  let activeRun: UnfinishedNcpAgentRun | null = null;
  for (const event of events) {
    if (event.type === NcpEventType.RunStarted) {
      activeRun = {
        sessionId,
        ...(event.payload.messageId ? { messageId: event.payload.messageId } : {}),
        ...(event.payload.runId ? { runId: event.payload.runId } : {}),
        ...(event.payload.startedAt ? { startedAt: event.payload.startedAt } : {}),
      };
      continue;
    }
    if (
      activeRun
      && (event.type === NcpEventType.RunFinished
        || event.type === NcpEventType.RunError
        || event.type === NcpEventType.MessageAbort)
      && (!event.payload.runId || !activeRun.runId || event.payload.runId === activeRun.runId)
    ) {
      activeRun = null;
    }
  }
  return activeRun;
}
