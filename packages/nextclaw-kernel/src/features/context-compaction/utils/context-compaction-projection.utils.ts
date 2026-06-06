import type { NcpMessage } from "@nextclaw/ncp";
import { readCompressedContextCompactionCheckpoint, type ContextCompactionCheckpoint } from "@nextclaw/core";
import { CONTEXT_COMPACTION_TIMELINE_KIND, NEXTCLAW_TIMELINE_KIND_METADATA_KEY } from "./context-compaction-timeline-message.utils.js";

function readCompactionCheckpoint(message: NcpMessage): ContextCompactionCheckpoint | null {
  const metadata = message.metadata;
  return metadata?.[NEXTCLAW_TIMELINE_KIND_METADATA_KEY] === CONTEXT_COMPACTION_TIMELINE_KIND
    ? readCompressedContextCompactionCheckpoint(metadata.checkpoint)
    : null;
}

export function readLatestContextCompactionCheckpoint(sessionMessages: readonly NcpMessage[]): ContextCompactionCheckpoint | null {
  return sessionMessages.reduce<ContextCompactionCheckpoint | null>((checkpoint, message) => {
    const candidateCheckpoint = readCompactionCheckpoint(message);
    return candidateCheckpoint && (!checkpoint || Date.parse(candidateCheckpoint.updatedAt) >= Date.parse(checkpoint.updatedAt))
      ? candidateCheckpoint
      : checkpoint;
  }, null);
}

export function projectNcpMessagesWithContextCompaction(params: {
  sessionId: string;
  sessionMessages: readonly NcpMessage[];
}): NcpMessage[] {
  const { sessionId, sessionMessages } = params;
  const checkpoint = readLatestContextCompactionCheckpoint(sessionMessages);
  if (!checkpoint) {
    return sessionMessages
      .filter((message) => !readCompactionCheckpoint(message))
      .map((message) => structuredClone(message));
  }

  return [
    {
      id: `${sessionId}:context-compaction-summary:${checkpoint.id}:${checkpoint.updatedAt}`,
      sessionId,
      role: "user",
      status: "final",
      timestamp: checkpoint.updatedAt,
      parts: [{ type: "text", text: checkpoint.summary }],
    },
    ...sessionMessages
      .filter((message) => !readCompactionCheckpoint(message) && Date.parse(message.timestamp) > Date.parse(checkpoint.updatedAt))
      .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
      .map((message) => structuredClone(message)),
  ];
}
