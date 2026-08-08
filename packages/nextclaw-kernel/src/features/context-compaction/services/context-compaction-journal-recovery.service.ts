import { NcpEventType, type NcpEndpointEvent, type NcpMessage } from "@nextclaw/ncp";

type RecoveredCompactionTerminal = {
  status: "cancelled" | "failed";
  updatedAt: string;
};

export class ContextCompactionJournalRecoveryService {
  private readonly pendingMessageIds = new Set<string>();
  private readonly recoveredTerminals = new Map<string, RecoveredCompactionTerminal>();

  seed = (messages: readonly NcpMessage[]): void => {
    for (const message of messages) {
      const checkpoint = this.readCheckpoint(message);
      if (!checkpoint) {
        continue;
      }
      if (checkpoint.status === "compressing") {
        this.pendingMessageIds.add(message.id);
      } else {
        this.pendingMessageIds.delete(message.id);
      }
    }
  };

  track = (event: NcpEndpointEvent): void => {
    if (event.type === NcpEventType.MessageSent) {
      const checkpoint = this.readCheckpoint(event.payload.message);
      if (!checkpoint) {
        return;
      }
      if (checkpoint.status === "compressing") {
        this.pendingMessageIds.add(event.payload.message.id);
        return;
      }
      this.pendingMessageIds.delete(event.payload.message.id);
      this.recoveredTerminals.delete(event.payload.message.id);
      return;
    }
    const terminalStatus = event.type === NcpEventType.MessageAbort
      ? "cancelled"
      : event.type === NcpEventType.RunError || event.type === NcpEventType.RunFinished
        ? "failed"
        : null;
    if (!terminalStatus || this.pendingMessageIds.size === 0) {
      return;
    }
    const updatedAt = event.occurredAt ?? new Date(0).toISOString();
    for (const messageId of this.pendingMessageIds) {
      this.recoveredTerminals.set(messageId, { status: terminalStatus, updatedAt });
    }
    this.pendingMessageIds.clear();
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
}
