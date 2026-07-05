import type { NcpEndpointEvent, NcpMessage } from "@nextclaw/ncp";
import { NcpEventType } from "@nextclaw/ncp";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import {
  createSessionActivityPreviewFromNcpEvent,
  readSessionActivityPreviewText,
} from "@kernel/contributions/session-activity-preview/utils/session-activity-preview-ncp-event.utils.js";
import { writeSessionActivityPreviewMetadata } from "@kernel/contributions/session-activity-preview/utils/session-activity-preview-metadata.utils.js";
import type { SessionActivityPreviewProjection } from "@kernel/contributions/session-activity-preview/types/session-activity-preview.types.js";

type SessionActivityPreviewEventServiceOptions = {
  getSessionRecord: (sessionId: string) => Promise<AgentSessionRecord | null>;
  updateSessionMetadata: (
    sessionId: string,
    metadata: Record<string, unknown>,
  ) => Promise<boolean>;
};

export class SessionActivityPreviewEventService {
  private readonly toolNames = new Map<string, string>();

  constructor(private readonly options: SessionActivityPreviewEventServiceOptions) {}

  projectEvent = (
    event: NcpEndpointEvent,
    timestamp: string,
  ): SessionActivityPreviewProjection | null => {
    this.rememberToolName(event);
    const projection = createSessionActivityPreviewFromNcpEvent(event, timestamp, {
      readToolName: this.readToolName,
    });
    this.clearFinishedRunToolNames(event);
    return projection;
  };

  updatePreview = async (
    projection: SessionActivityPreviewProjection,
  ): Promise<void> => {
    const session = await this.options.getSessionRecord(projection.sessionId);
    const replyText = projection.preview.replyText ??
      (projection.preview.state === "completed"
        ? this.readLatestAssistantPreviewText(session?.messages)
        : undefined);
    const nextMetadata = writeSessionActivityPreviewMetadata(session?.metadata, {
      ...projection,
      preview: {
        ...projection.preview,
        replyText,
      },
    });
    if (nextMetadata) {
      await this.options.updateSessionMetadata(projection.sessionId, nextMetadata);
    }
  };

  clear = (): void => {
    this.toolNames.clear();
  };

  private rememberToolName = (event: NcpEndpointEvent): void => {
    if (event.type !== NcpEventType.MessageToolCallStart) {
      return;
    }
    const { sessionId, toolCallId, toolName } = event.payload;
    if (sessionId && toolCallId && toolName) {
      this.toolNames.set(this.createToolNameKey(sessionId, toolCallId), toolName);
    }
  };

  private readToolName = (sessionId: string, toolCallId: string): string | null =>
    this.toolNames.get(this.createToolNameKey(sessionId, toolCallId)) ?? null;

  private clearFinishedRunToolNames = (event: NcpEndpointEvent): void => {
    if (
      event.type !== NcpEventType.RunFinished &&
      event.type !== NcpEventType.RunError &&
      event.type !== NcpEventType.MessageAbort
    ) {
      return;
    }
    const sessionId = event.payload.sessionId;
    for (const key of this.toolNames.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        this.toolNames.delete(key);
      }
    }
  };

  private createToolNameKey = (sessionId: string, toolCallId: string): string =>
    `${sessionId}:${toolCallId}`;

  private readLatestAssistantPreviewText = (
    messages: readonly NcpMessage[] | undefined,
  ): string | undefined => {
    for (let index = (messages?.length ?? 0) - 1; index >= 0; index -= 1) {
      const message = messages?.[index];
      if (message?.role === "assistant") {
        return readSessionActivityPreviewText(message) ?? undefined;
      }
    }
    return undefined;
  };
}
