import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import { eventKeys, type Unsubscribe } from "@nextclaw/shared";
import type { SessionActivityPreviewProjection } from "./types/session-activity-preview.types.js";
import { createSessionActivityPreviewFromNcpEvent } from "./utils/session-activity-preview-ncp-event.utils.js";
import { writeSessionActivityPreviewMetadata } from "./utils/session-activity-preview-metadata.utils.js";

export class SessionActivityPreviewContribution implements KernelContribution {
  private unsubscribeNcpEvent: Unsubscribe | null = null;
  private readonly metadataWriteChains = new Map<string, Promise<void>>();
  private readonly toolNames = new Map<string, string>();

  constructor(private readonly kernel: NextclawKernel) {}

  start = (): void => {
    if (this.unsubscribeNcpEvent) {
      return;
    }
    this.unsubscribeNcpEvent = this.kernel.eventBus.on(eventKeys.ncpEvent, (event) => {
      this.rememberToolName(event);
      const projection = createSessionActivityPreviewFromNcpEvent(event, new Date().toISOString(), {
        readToolName: this.readToolName,
      });
      this.clearFinishedRunToolNames(event);
      if (!projection) {
        return;
      }
      this.updatePreview(projection);
    });
  };

  dispose = (): void => {
    this.unsubscribeNcpEvent?.();
    this.unsubscribeNcpEvent = null;
    this.metadataWriteChains.clear();
    this.toolNames.clear();
  };

  private rememberToolName = (event: NcpEndpointEvent): void => {
    if (event.type !== NcpEventType.MessageToolCallStart) {
      return;
    }
    const sessionId = event.payload.sessionId.trim();
    const toolCallId = event.payload.toolCallId.trim();
    const toolName = event.payload.toolName.trim();
    if (!sessionId || !toolCallId || !toolName) {
      return;
    }
    this.toolNames.set(this.createToolNameKey(sessionId, toolCallId), toolName);
  };

  private readToolName = (sessionId: string, toolCallId: string): string | null =>
    this.toolNames.get(this.createToolNameKey(sessionId, toolCallId)) ?? null;

  private clearFinishedRunToolNames = (event: NcpEndpointEvent): void => {
    if (event.type !== NcpEventType.RunFinished && event.type !== NcpEventType.RunError) {
      return;
    }
    const sessionId = this.readNonEmptyString(event.payload.sessionId);
    if (!sessionId) {
      return;
    }
    for (const key of this.toolNames.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        this.toolNames.delete(key);
      }
    }
  };

  private readNonEmptyString = (value: unknown): string | null => {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  private createToolNameKey = (sessionId: string, toolCallId: string): string => `${sessionId}:${toolCallId}`;

  private updatePreview = (projection: SessionActivityPreviewProjection): void => {
    const previous = this.metadataWriteChains.get(projection.sessionId) ?? Promise.resolve();
    const next = previous.then(() => this.updatePreviewMetadata(projection));
    this.metadataWriteChains.set(projection.sessionId, next.catch(() => undefined));
    void next
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.stack ?? error.message : String(error);
        console.error(
          `[session-activity-preview] failed to update ${projection.sessionId}: ${message}`,
        );
      });
  };

  private updatePreviewMetadata = async (projection: SessionActivityPreviewProjection): Promise<void> => {
    const session = await this.kernel.sessionManager.getSessionRecord(projection.sessionId);
    const nextMetadata = writeSessionActivityPreviewMetadata(session?.metadata, projection);
    if (!nextMetadata) {
      return;
    }
    await this.kernel.sessionManager.updateSessionMetadata(projection.sessionId, nextMetadata);
  };
}
