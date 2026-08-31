import {
  readParentSessionId,
  type SessionRequestToolResult,
  type SpawnSessionAndRequestParams,
} from "@nextclaw/core";
import { NcpEventType, type NcpEndpointEvent, type NcpMessage } from "@nextclaw/ncp";
import { Contribution, eventKeys, type Unsubscribe } from "@nextclaw/shared";
import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import {
  LEARNING_LOOP_DISABLED_METADATA_KEY,
  LEARNING_LOOP_LAST_REQUESTED_AT_METADATA_KEY,
  LEARNING_LOOP_LAST_REVIEW_SESSION_ID_METADATA_KEY,
  LEARNING_LOOP_LAST_TOOL_CALL_COUNT_METADATA_KEY,
  LEARNING_LOOP_SOURCE_SESSION_ID_METADATA_KEY,
  readLearningLoopRuntimeConfig,
  type LearningLoopRuntimeConfig,
} from "./config.js";
import { buildLearningLoopTask } from "./utils/learning-loop-prompt.utils.js";

export type LearningLoopSessionRequester = {
  spawnSessionAndRequest: (
    params: SpawnSessionAndRequestParams,
  ) => Promise<SessionRequestToolResult>;
};

type LearningLoopSessionStore = Pick<
  SessionManager,
  "getSessionRecord" | "updateSessionMetadata"
>;

function countToolCallsFromMessage(message: NcpMessage): number {
  if (!Array.isArray(message.parts)) {
    return 0;
  }
  const seenIds = new Set<string>();
  let anonymousCount = 0;
  for (const part of message.parts) {
    if (!part || typeof part !== "object" || Array.isArray(part)) {
      continue;
    }
    const candidate = part as {
      type?: unknown;
      toolCallId?: unknown;
    };
    if (candidate.type !== "tool-invocation") {
      continue;
    }
    if (typeof candidate.toolCallId === "string" && candidate.toolCallId.trim()) {
      seenIds.add(candidate.toolCallId.trim());
      continue;
    }
    anonymousCount += 1;
  }
  return seenIds.size + anonymousCount;
}

function countSessionToolCalls(messages: readonly NcpMessage[]): number {
  return messages.reduce((count, message) => count + countToolCallsFromMessage(message), 0);
}

function readSessionLabel(metadata: Record<string, unknown>): string | undefined {
  const label = metadata.label;
  return typeof label === "string" && label.trim().length > 0 ? label.trim() : undefined;
}

function isLearningLoopDisabled(metadata: Record<string, unknown>): boolean {
  return metadata[LEARNING_LOOP_DISABLED_METADATA_KEY] === true;
}

function readLearningLoopLastToolCallCount(
  metadata: Record<string, unknown>,
): number {
  const value = metadata[LEARNING_LOOP_LAST_TOOL_CALL_COUNT_METADATA_KEY];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readRunFinishedSessionId(event: NcpEndpointEvent): string | null {
  if (event.type !== NcpEventType.RunFinished) {
    return null;
  }
  return event.payload.sessionId?.trim() || null;
}

export class LearningLoopContribution extends Contribution {
  private readonly sessionStore: LearningLoopSessionStore;
  private readonly sessionRequester: LearningLoopSessionRequester;
  private readonly inFlightSessionIds = new Set<string>();

  constructor(private readonly kernel: NextclawKernel) {
    super();
    this.sessionStore = kernel.sessionManager;
    this.sessionRequester = kernel.sessionRequests;
  }

  protected setup = (): void => {
    this.effect(() => {
      const unsubscribe: Unsubscribe = this.kernel.eventBus.on(
        eventKeys.ncpEvent,
        this.handleNcpEvent,
      );
      return () => {
        unsubscribe();
        this.inFlightSessionIds.clear();
      };
    });
  };

  private handleNcpEvent = (event: NcpEndpointEvent): void => {
    const sessionId = readRunFinishedSessionId(event);
    if (!sessionId) {
      return;
    }
    void this.handleRunFinishedInBackground(sessionId).catch((error) => {
      console.warn(
        `[learning-loop] Failed for ${sessionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  };

  private handleRunFinishedInBackground = async (
    sessionId: string,
  ): Promise<void> => {
    if (this.inFlightSessionIds.has(sessionId)) {
      return;
    }
    const session = await this.sessionStore.getSessionRecord(sessionId);
    const metadata = session?.metadata ?? {};
    if (!session || readParentSessionId(metadata)) {
      return;
    }
    const runtimeConfig = this.readRuntimeConfig();
    if (!runtimeConfig.enabled || isLearningLoopDisabled(metadata)) {
      return;
    }
    const totalToolCalls = countSessionToolCalls(session.messages);
    const lastReviewedToolCallCount = readLearningLoopLastToolCallCount(
      metadata,
    );
    const toolCallsSinceReview = totalToolCalls - lastReviewedToolCallCount;
    if (toolCallsSinceReview < runtimeConfig.toolCallThreshold) {
      return;
    }

    this.inFlightSessionIds.add(sessionId);
    try {
      const triggeredAt = new Date().toISOString();
      const reviewSession = await this.sessionRequester.spawnSessionAndRequest({
        sourceSessionId: sessionId,
        sourceSessionMetadata: metadata,
        metadataOverrides: {
          [LEARNING_LOOP_DISABLED_METADATA_KEY]: true,
          [LEARNING_LOOP_SOURCE_SESSION_ID_METADATA_KEY]: sessionId,
        },
        parentSessionId: sessionId,
        notify: "none",
        wait: "none",
        title: this.buildReviewTitle(metadata),
        task: buildLearningLoopTask({
          sessionId,
          toolCallsSinceReview,
          currentToolCallCount: totalToolCalls,
        }),
        trigger: {
          actor: "automation",
          source: "learning-loop",
          triggeredAt,
          sourceSessionId: sessionId,
          ...(typeof metadata.preferred_model === "string" && metadata.preferred_model.trim()
            ? { sourceModel: metadata.preferred_model.trim() }
            : {}),
        },
      });
      await this.sessionStore.updateSessionMetadata(sessionId, {
        [LEARNING_LOOP_LAST_TOOL_CALL_COUNT_METADATA_KEY]: totalToolCalls,
        [LEARNING_LOOP_LAST_REQUESTED_AT_METADATA_KEY]: triggeredAt,
        [LEARNING_LOOP_LAST_REVIEW_SESSION_ID_METADATA_KEY]:
          reviewSession.sessionId,
      });
    } finally {
      this.inFlightSessionIds.delete(sessionId);
    }
  };

  private readRuntimeConfig = (): LearningLoopRuntimeConfig => {
    return readLearningLoopRuntimeConfig(this.kernel.configManager.loadConfig());
  };

  private buildReviewTitle = (metadata: Record<string, unknown>): string => {
    const label = readSessionLabel(metadata);
    return label ? `Learning loop: ${label}` : "Learning loop";
  };
}
