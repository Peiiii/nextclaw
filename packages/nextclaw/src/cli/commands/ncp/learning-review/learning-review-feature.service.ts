import {
  type Session,
  type SessionMessage,
} from "@nextclaw/core";
import { agentRunFinishedLifecycleEventKey } from "../lifecycle-events/ncp-lifecycle-event.config.js";
import type { AgentRunFinishedLifecycleEvent } from "../lifecycle-events/ncp-lifecycle-event.types.js";
import {
  DEFAULT_LEARNING_REVIEW_TOOL_CALL_THRESHOLD,
  LEARNING_REVIEW_DISABLED_METADATA_KEY,
  LEARNING_REVIEW_LAST_REQUESTED_AT_METADATA_KEY,
  LEARNING_REVIEW_LAST_REVIEW_SESSION_ID_METADATA_KEY,
  LEARNING_REVIEW_LAST_TOOL_CALL_COUNT_METADATA_KEY,
  LEARNING_REVIEW_REQUESTED_SKILLS,
  LEARNING_REVIEW_SOURCE_SESSION_ID_METADATA_KEY,
} from "./learning-review.config.js";
import { buildLearningReviewTask } from "./learning-review-prompt.utils.js";
import type { LearningReviewFeatureConfig } from "./learning-review.types.js";

function readBoolean(value: unknown): boolean {
  return value === true;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function countToolCallsFromMessage(message: SessionMessage): number {
  if (Array.isArray(message.tool_calls)) {
    return message.tool_calls.filter(
      (toolCall) =>
        Boolean(toolCall) &&
        typeof toolCall === "object" &&
        !Array.isArray(toolCall),
    ).length;
  }
  if (!Array.isArray(message.ncp_parts)) {
    return 0;
  }
  const seenIds = new Set<string>();
  let anonymousCount = 0;
  for (const part of message.ncp_parts) {
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

function countSessionToolCalls(session: Session): number {
  return session.messages.reduce((count, message) => count + countToolCallsFromMessage(message), 0);
}

function readSessionLabel(metadata: Record<string, unknown>): string | undefined {
  const label = metadata.label;
  return typeof label === "string" && label.trim().length > 0 ? label.trim() : undefined;
}

export class LearningReviewFeature {
  private readonly toolCallThreshold: number;
  private readonly inFlightSessionIds = new Set<string>();
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly config: LearningReviewFeatureConfig) {
    this.toolCallThreshold =
      config.toolCallThreshold ?? DEFAULT_LEARNING_REVIEW_TOOL_CALL_THRESHOLD;
  }

  start = (): void => {
    if (this.unsubscribe) {
      return;
    }
    this.unsubscribe = this.config.eventBus.on(
      agentRunFinishedLifecycleEventKey,
      this.handleRunFinished,
    );
  };

  dispose = (): void => {
    this.unsubscribe?.();
    this.unsubscribe = null;
  };

  private handleRunFinished = (event: AgentRunFinishedLifecycleEvent): void => {
    void this.handleRunFinishedInBackground(event).catch((error) => {
      console.warn(
        `[learning-review] Failed for ${event.sessionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  };

  private handleRunFinishedInBackground = async (
    event: AgentRunFinishedLifecycleEvent,
  ): Promise<void> => {
    if (event.isChildSession || this.inFlightSessionIds.has(event.sessionId)) {
      return;
    }
    const session = this.config.sessionStore.getIfExists(event.sessionId);
    if (!session) {
      return;
    }
    if (readBoolean(session.metadata[LEARNING_REVIEW_DISABLED_METADATA_KEY])) {
      return;
    }
    const totalToolCalls = countSessionToolCalls(session);
    const lastReviewedToolCallCount =
      readNumber(
        session.metadata[LEARNING_REVIEW_LAST_TOOL_CALL_COUNT_METADATA_KEY],
      ) ?? 0;
    const toolCallsSinceReview = totalToolCalls - lastReviewedToolCallCount;
    if (toolCallsSinceReview < this.toolCallThreshold) {
      return;
    }

    this.inFlightSessionIds.add(event.sessionId);
    try {
      const reviewSession = await this.config.sessionRequester.spawnSessionAndRequest({
        sourceSessionId: event.sessionId,
        sourceSessionMetadata: session.metadata,
        metadataOverrides: {
          requested_skills: LEARNING_REVIEW_REQUESTED_SKILLS,
          [LEARNING_REVIEW_DISABLED_METADATA_KEY]: true,
          [LEARNING_REVIEW_SOURCE_SESSION_ID_METADATA_KEY]: event.sessionId,
        },
        parentSessionId: event.sessionId,
        notify: "none",
        title: this.buildReviewTitle(session.metadata),
        task: buildLearningReviewTask({
          sessionId: event.sessionId,
          toolCallsSinceReview,
          currentToolCallCount: totalToolCalls,
        }),
      });
      session.metadata = {
        ...session.metadata,
        [LEARNING_REVIEW_LAST_TOOL_CALL_COUNT_METADATA_KEY]: totalToolCalls,
        [LEARNING_REVIEW_LAST_REQUESTED_AT_METADATA_KEY]: new Date().toISOString(),
        [LEARNING_REVIEW_LAST_REVIEW_SESSION_ID_METADATA_KEY]:
          reviewSession.sessionId,
      };
      this.config.sessionStore.save(session);
    } finally {
      this.inFlightSessionIds.delete(event.sessionId);
    }
  };

  private buildReviewTitle = (metadata: Record<string, unknown>): string => {
    const label = readSessionLabel(metadata);
    return label ? `Learning review: ${label}` : "Learning review";
  };
}
