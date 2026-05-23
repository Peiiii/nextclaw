import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { eventKeys, type Unsubscribe } from "@nextclaw/shared";
import type { SessionActivityPreviewProjection } from "./types/session-activity-preview.types.js";
import { createSessionActivityPreviewFromNcpEvent } from "./utils/session-activity-preview-ncp-event.utils.js";
import { writeSessionActivityPreviewMetadata } from "./utils/session-activity-preview-metadata.utils.js";

export class SessionActivityPreviewContribution implements KernelContribution {
  private unsubscribeNcpEvent: Unsubscribe | null = null;

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
  };

  private updatePreview = (projection: SessionActivityPreviewProjection): void => {
    void this.kernel.ncpSessionManager
      .patchSessionMetadata(
        projection.sessionId,
        (metadata) => writeSessionActivityPreviewMetadata(metadata, projection),
      )
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.stack ?? error.message : String(error);
        console.error(
          `[session-activity-preview] failed to update ${projection.sessionId}: ${message}`,
        );
      });
  };
}
