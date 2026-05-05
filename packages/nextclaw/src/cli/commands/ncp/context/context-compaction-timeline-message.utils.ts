import type { Session, SessionEvent, SessionMessage } from "@nextclaw/core";

export const NEXTCLAW_TIMELINE_KIND_METADATA_KEY = "nextclaw_timeline_kind";
export const CONTEXT_COMPACTION_TIMELINE_KIND = "context_compaction";

export type ContextCompactionTimelineCheckpoint = {
  id: string;
  status: "compressing" | "compressed";
  summary: string;
  coveredMessageCount: number;
  coveredSessionMessageCount: number;
  coveredUntilMessageId?: string;
  originalEstimatedTokens: number;
  projectedEstimatedTokens: number;
  createdAt: string;
  updatedAt: string;
};

type ContextCompactionTimelineMetadata = {
  [NEXTCLAW_TIMELINE_KIND_METADATA_KEY]: typeof CONTEXT_COMPACTION_TIMELINE_KIND;
  checkpoint: ContextCompactionTimelineCheckpoint;
};

function readTimelineMetadata(message: SessionMessage | null | undefined): ContextCompactionTimelineMetadata | null {
  const rawMetadata = message?.ncp_metadata;
  if (!rawMetadata || typeof rawMetadata !== "object" || Array.isArray(rawMetadata)) {
    return null;
  }
  const metadata = rawMetadata as Record<string, unknown>;
  if (metadata[NEXTCLAW_TIMELINE_KIND_METADATA_KEY] !== CONTEXT_COMPACTION_TIMELINE_KIND) {
    return null;
  }
  const checkpoint =
    metadata.checkpoint && typeof metadata.checkpoint === "object" && !Array.isArray(metadata.checkpoint)
      ? (metadata.checkpoint as ContextCompactionTimelineCheckpoint)
      : null;
  if (!checkpoint) {
    return null;
  }
  return {
    [NEXTCLAW_TIMELINE_KIND_METADATA_KEY]: CONTEXT_COMPACTION_TIMELINE_KIND,
    checkpoint,
  };
}

function buildTimelineMessage(checkpoint: ContextCompactionTimelineCheckpoint): SessionMessage {
  return {
    role: "service",
    content:
      checkpoint.status === "compressing"
        ? "正在压缩较早上下文"
        : "较早上下文已自动压缩",
    timestamp: checkpoint.updatedAt,
    ncp_parts: [
      {
        type: "text",
        text:
          checkpoint.status === "compressing"
            ? "正在压缩较早上下文"
            : "较早上下文已自动压缩",
      },
    ],
    ncp_metadata: {
      [NEXTCLAW_TIMELINE_KIND_METADATA_KEY]: CONTEXT_COMPACTION_TIMELINE_KIND,
      checkpoint,
    },
  };
}

export function upsertContextCompactionTimelineMessage(params: {
  session: Session;
  checkpoint: ContextCompactionTimelineCheckpoint;
}): void {
  const { checkpoint, session } = params;
  const nextMessage = buildTimelineMessage(checkpoint);
  for (let index = session.events.length - 1; index >= 0; index -= 1) {
    const event = session.events[index];
    const message =
      event?.data?.message && typeof event.data.message === "object" && !Array.isArray(event.data.message)
        ? (event.data.message as SessionMessage)
        : null;
    const metadata = readTimelineMetadata(message);
    if (!metadata) {
      continue;
    }
    event.timestamp = checkpoint.updatedAt;
    event.data.message = nextMessage;
    session.messages = session.messages.map((item) => {
      const itemMetadata = readTimelineMetadata(item);
      return itemMetadata?.checkpoint.id === metadata.checkpoint.id ? nextMessage : item;
    });
    session.updatedAt = new Date(checkpoint.updatedAt);
    return;
  }

  const event: SessionEvent = {
    seq: session.nextSeq,
    type: "message.service",
    timestamp: checkpoint.updatedAt,
    data: {
      message: nextMessage,
    },
  };
  session.nextSeq += 1;
  session.events.push(event);
  session.messages.push(nextMessage);
  session.updatedAt = new Date(checkpoint.updatedAt);
}

export function isContextCompactionTimelineMessage(message: { metadata?: Record<string, unknown> | undefined } | null | undefined): boolean {
  return message?.metadata?.[NEXTCLAW_TIMELINE_KIND_METADATA_KEY] === CONTEXT_COMPACTION_TIMELINE_KIND;
}
