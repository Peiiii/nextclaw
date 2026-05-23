import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { eventKeys, type Unsubscribe } from "@nextclaw/shared";
import type { SessionActivityPreviewProjection } from "./types/session-activity-preview.types.js";
import { createSessionActivityPreviewFromNcpEvent } from "./utils/session-activity-preview-ncp-event.utils.js";
import { writeSessionActivityPreviewMetadata } from "./utils/session-activity-preview-metadata.utils.js";

export class SessionActivityPreviewContribution implements KernelContribution {
  private unsubscribeNcpEvent: Unsubscribe | null = null;
  private readonly metadataWriteChains = new Map<string, Promise<void>>();

  constructor(private readonly kernel: NextclawKernel) {}

  start = (): void => {
    if (this.unsubscribeNcpEvent) {
      return;
    }
    this.unsubscribeNcpEvent = this.kernel.eventBus.on(eventKeys.ncpEvent, (event) => {
      const projection = createSessionActivityPreviewFromNcpEvent(event, new Date().toISOString());
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
  };

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
    const session = await this.kernel.ncpSessionManager.getSessionRecord(projection.sessionId);
    const nextMetadata = writeSessionActivityPreviewMetadata(session?.metadata, projection);
    if (!nextMetadata) {
      return;
    }
    await this.kernel.ncpSessionManager.updateSessionMetadata(projection.sessionId, nextMetadata);
  };
}
