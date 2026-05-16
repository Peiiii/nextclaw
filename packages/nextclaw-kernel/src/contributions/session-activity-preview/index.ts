import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { eventKeys, type Unsubscribe } from "@nextclaw/shared";
import type { SessionActivityPreviewProjection } from "./types/session-activity-preview.types.js";
import { createSessionActivityPreviewFromNcpEvent } from "./utils/session-activity-preview-ncp-event.utils.js";
import { writeSessionActivityPreviewMetadata } from "./utils/session-activity-preview-metadata.utils.js";

function formatBackgroundError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}

function readMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export class SessionActivityPreviewContribution implements KernelContribution {
  private unsubscribeNcpEvent: Unsubscribe | null = null;
  private stopped = true;

  constructor(private readonly kernel: NextclawKernel) {}

  start = (): void => {
    if (this.unsubscribeNcpEvent) {
      return;
    }
    this.stopped = false;
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
    this.stopped = true;
  };

  private updatePreview = (projection: SessionActivityPreviewProjection): void => {
    void this.persistPreview(projection)
      .catch((error: unknown) => {
        console.error(
          `[session-activity-preview] failed to update ${projection.sessionId}: ${formatBackgroundError(error)}`,
        );
      });
  };

  private persistPreview = async (projection: SessionActivityPreviewProjection): Promise<void> => {
    if (this.stopped) {
      return;
    }
    const summary = await this.kernel.ncpSessionApi.getSession(projection.sessionId);
    if (!summary || this.stopped) {
      return;
    }
    const metadata = readMetadata(summary.metadata);
    const nextMetadata = writeSessionActivityPreviewMetadata(metadata, projection);
    if (!nextMetadata) {
      return;
    }
    await this.kernel.ncpSessionApi.updateSession(projection.sessionId, {
      metadata: nextMetadata,
    });
  };
}
