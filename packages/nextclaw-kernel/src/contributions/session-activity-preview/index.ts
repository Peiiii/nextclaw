import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { eventKeys, type Unsubscribe } from "@nextclaw/shared";
import type { SessionActivityPreviewProjection } from "./types/session-activity-preview.types.js";
import { createSessionActivityPreviewFromNcpEvent } from "./utils/session-activity-preview-ncp-event.utils.js";
import { writeSessionActivityPreviewMetadata } from "./utils/session-activity-preview-metadata.utils.js";

export class SessionActivityPreviewContribution implements KernelContribution {
  private unsubscribeNcpEvent: Unsubscribe | null = null;
  private readonly previewWriteChains = new Map<string, Promise<void>>();

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
    this.previewWriteChains.clear();
  };

  private updatePreview = (projection: SessionActivityPreviewProjection): void => {
    const next = (this.previewWriteChains.get(projection.sessionId) ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => this.persistPreview(projection));
    this.previewWriteChains.set(projection.sessionId, next);
    void next
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.stack ?? error.message : String(error);
        console.error(
          `[session-activity-preview] failed to update ${projection.sessionId}: ${message}`,
        );
      })
      .finally(() => {
        if (this.previewWriteChains.get(projection.sessionId) === next) {
          this.previewWriteChains.delete(projection.sessionId);
        }
      });
  };

  private persistPreview = async (projection: SessionActivityPreviewProjection): Promise<void> => {
    if (!this.unsubscribeNcpEvent) {
      return;
    }
    const summary = await this.kernel.ncpSessionApi.getSession(projection.sessionId);
    if (!summary || !this.unsubscribeNcpEvent) {
      return;
    }
    const metadata = summary.metadata && typeof summary.metadata === "object" && !Array.isArray(summary.metadata)
      ? summary.metadata as Record<string, unknown>
      : undefined;
    const nextMetadata = writeSessionActivityPreviewMetadata(metadata, projection);
    if (!nextMetadata) {
      return;
    }
    await this.kernel.ncpSessionApi.updateSession(projection.sessionId, {
      metadata: nextMetadata,
    });
  };
}
