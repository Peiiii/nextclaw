import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import type { NcpAgentSessionJournalReplayEvent } from "./ncp-agent-session-journal.utils.js";
import { readEventToolCallId, readMessageFromSummaryEvent, readEventMessageId } from "./ncp-agent-session-replay-event.utils.js";

export function seedReplayToolOwners(messages: readonly NcpMessage[]): Map<string, string> {
  const owners = new Map<string, string>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === "tool-invocation" && part.toolCallId) owners.set(part.toolCallId, message.id);
    }
  }
  return owners;
}

export function readReplayToolOwners(event: NcpAgentSessionJournalReplayEvent): Map<string, string> {
  const message = readMessageFromSummaryEvent(event);
  const owners = seedReplayToolOwners(message ? [message] : []);
  if (event.type === NcpEventType.MessageToolCallStart && event.payload.messageId) {
    owners.set(event.payload.toolCallId, event.payload.messageId);
  }
  return owners;
}

// A result for an older message can arrive after its checkpoint was settled.
// In that case the active seed alone cannot prove ownership: read the journal.
export function needsReplayToolHistory(
  events: readonly NcpAgentSessionJournalReplayEvent[],
  seeds: readonly NcpMessage[],
): boolean {
  const owners = seedReplayToolOwners(seeds);
  for (const event of events) {
    const toolCallId = readEventToolCallId(event);
    if (toolCallId && !readEventMessageId(event) && !owners.has(toolCallId)) return true;
    for (const [callId, messageId] of readReplayToolOwners(event)) owners.set(callId, messageId);
  }
  return false;
}
