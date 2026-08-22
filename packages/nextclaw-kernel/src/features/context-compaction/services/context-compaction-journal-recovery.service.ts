import { NcpEventType, type NcpEndpointEvent, type NcpMessage } from "@nextclaw/ncp";

type RecoveredCompactionTerminal = {
  status: "cancelled" | "failed";
  updatedAt: string;
};

export class ContextCompactionJournalRecoveryService {
  private readonly pendingMessageIds = new Set<string>();
  private readonly pendingCheckpoints = new Map<string, Record<string, unknown>>();
  private readonly recoveredTerminals = new Map<string, RecoveredCompactionTerminal>();
  private readonly terminalMessages = new Map<string, RecoveredCompactionTerminal>();

  seed = (messages: readonly NcpMessage[]): void => {
    for (const message of messages) {
      if (
        message.role === "assistant" &&
        (message.status === "final" || message.status === "error")
      ) {
        this.terminalMessages.set(message.id, {
          status: "failed",
          updatedAt: message.lifecycle?.endedAt ?? message.timestamp,
        });
      }
      const checkpoint = this.readCheckpoint(message);
      if (!checkpoint) {
        continue;
      }
      if (checkpoint.status === "compressing") {
        this.pendingMessageIds.add(message.id);
        this.pendingCheckpoints.set(message.id, structuredClone(checkpoint));
      } else {
        this.pendingMessageIds.delete(message.id);
        this.pendingCheckpoints.delete(message.id);
        this.recoveredTerminals.delete(message.id);
      }
    }
  };

  track = (event: NcpEndpointEvent): void => {
    if (event.type === NcpEventType.MessageSent) {
      this.trackMessageSent(event);
      return;
    }
    this.trackTerminalEvent(event);
  };

  private trackMessageSent = (
    event: Extract<NcpEndpointEvent, { type: NcpEventType.MessageSent }>,
  ): void => {
    const checkpoint = this.readCheckpoint(event.payload.message);
    if (!checkpoint) {
      return;
    }
    if (checkpoint.status === "compressing") {
      this.pendingMessageIds.add(event.payload.message.id);
      this.pendingCheckpoints.set(event.payload.message.id, structuredClone(checkpoint));
      const continuationMessageId = this.readContinuationMessageId(checkpoint);
      const terminal = continuationMessageId
        ? this.terminalMessages.get(continuationMessageId)
        : undefined;
      if (terminal) {
        this.recoveredTerminals.set(event.payload.message.id, terminal);
      }
      return;
    }
    this.pendingMessageIds.delete(event.payload.message.id);
    this.pendingCheckpoints.delete(event.payload.message.id);
    this.recoveredTerminals.delete(event.payload.message.id);
  };

  private trackTerminalEvent = (event: NcpEndpointEvent): void => {
    const terminalStatus = event.type === NcpEventType.MessageAbort
      ? "cancelled"
      : event.type === NcpEventType.RunError || event.type === NcpEventType.RunFinished
        ? "failed"
        : null;
    if (!terminalStatus) {
      return;
    }
    const updatedAt = event.occurredAt ?? new Date(0).toISOString();
    const terminal = { status: terminalStatus, updatedAt } satisfies RecoveredCompactionTerminal;
    const eventMessageId = this.readEventMessageId(event);
    if (eventMessageId) {
      this.terminalMessages.set(eventMessageId, terminal);
    }
    if (this.pendingMessageIds.size === 0) {
      return;
    }
    const pendingMessageIds = [...this.pendingMessageIds];
    const targetedMessageIds = eventMessageId
      ? pendingMessageIds.filter((messageId) => {
          const checkpoint = this.readCheckpointByMessageId(messageId);
          return this.readContinuationMessageId(checkpoint) === eventMessageId;
        })
      : [];
    const legacyMessageIds = pendingMessageIds.filter((messageId) =>
      this.readContinuationMessageId(this.readCheckpointByMessageId(messageId)) === null,
    );
    const messageIds = targetedMessageIds.length > 0
      ? [...targetedMessageIds, ...legacyMessageIds]
      : eventMessageId && legacyMessageIds.length < pendingMessageIds.length
        ? legacyMessageIds
        : pendingMessageIds;
    for (const messageId of messageIds) {
      this.recoveredTerminals.set(messageId, terminal);
      this.pendingMessageIds.delete(messageId);
      this.pendingCheckpoints.delete(messageId);
    }
  };

  terminalize = (message: NcpMessage): NcpMessage => {
    const terminal = this.recoveredTerminals.get(message.id);
    if (!terminal) {
      return structuredClone(message);
    }
    const checkpoint = this.readCheckpoint(message);
    if (!checkpoint || checkpoint.status !== "compressing") {
      return structuredClone(message);
    }
    return {
      ...structuredClone(message),
      parts: [{
        type: "text",
        text: terminal.status === "cancelled"
          ? "Context compaction was cancelled"
          : "Context compaction failed"
      }],
      metadata: {
        ...structuredClone(message.metadata ?? {}),
        checkpoint: {
          ...structuredClone(checkpoint),
          status: terminal.status,
          updatedAt: terminal.updatedAt
        }
      }
    };
  };

  private readCheckpoint = (message: NcpMessage): Record<string, unknown> | null => {
    const metadata = message.metadata;
    const checkpoint = metadata?.checkpoint;
    return metadata?.nextclaw_timeline_kind === "context_compaction"
      && checkpoint
      && typeof checkpoint === "object"
      && !Array.isArray(checkpoint)
      ? checkpoint as Record<string, unknown>
      : null;
  };

  private readCheckpointByMessageId = (messageId: string): Record<string, unknown> | null => {
    const checkpoint = this.pendingCheckpoints.get(messageId);
    return checkpoint ? structuredClone(checkpoint) : null;
  };

  private readContinuationMessageId = (checkpoint: Record<string, unknown> | null): string | null => {
    const value = checkpoint?.continuationMessageId;
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };

  private readEventMessageId = (event: NcpEndpointEvent): string | null => {
    if (event.type === NcpEventType.MessageAbort || event.type === NcpEventType.RunError || event.type === NcpEventType.RunFinished) {
      const messageId = event.payload.messageId;
      return typeof messageId === "string" && messageId.trim() ? messageId.trim() : null;
    }
    return null;
  };
}
