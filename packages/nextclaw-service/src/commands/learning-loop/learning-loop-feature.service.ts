import {
  type Session,
  type SessionMessage,
} from "@nextclaw/core";
import { agentRunFinishedLifecycleEventKey } from "../ncp/shared/lifecycle-events/ncp-lifecycle-event.config.js";
import type { AgentRunFinishedLifecycleEvent } from "../ncp/shared/lifecycle-events/ncp-lifecycle-event.types.js";
import {
  DEFAULT_LEARNING_LOOP_TOOL_CALL_THRESHOLD,
  LEARNING_LOOP_DISABLED_METADATA_KEY,
  LEARNING_LOOP_LAST_REQUESTED_AT_METADATA_KEY,
  LEARNING_LOOP_LAST_REVIEW_SESSION_ID_METADATA_KEY,
  LEARNING_LOOP_LAST_TOOL_CALL_COUNT_METADATA_KEY,
  LEARNING_LOOP_REQUESTED_SKILLS,
  LEARNING_LOOP_SOURCE_SESSION_ID_METADATA_KEY,
} from "./learning-loop.config.js";
import { buildLearningLoopTask } from "./learning-loop-prompt.utils.js";
import type { LearningLoopFeatureConfig } from "./learning-loop.types.js";

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

function isLearningLoopDisabled(metadata: Record<string, unknown>): boolean {
  return metadata[LEARNING_LOOP_DISABLED_METADATA_KEY] === true;
}

function readLearningLoopLastToolCallCount(
  metadata: Record<string, unknown>,
): number {
  const value = metadata[LEARNING_LOOP_LAST_TOOL_CALL_COUNT_METADATA_KEY];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export class LearningLoopFeature {
  private readonly inFlightSessionIds = new Set<string>();
  private unsubscribe: (() => void) | null = null;
  constructor(private readonly config: LearningLoopFeatureConfig) {}

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
        `[learning-loop] Failed for ${event.sessionId}: ${
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
    const runtimeConfig = this.readRuntimeConfig();
    if (!runtimeConfig.enabled) {
      return;
    }
    if (isLearningLoopDisabled(session.metadata)) {
      return;
    }
    const totalToolCalls = countSessionToolCalls(session);
    const lastReviewedToolCallCount = readLearningLoopLastToolCallCount(
      session.metadata,
    );
    const toolCallsSinceReview = totalToolCalls - lastReviewedToolCallCount;
    if (toolCallsSinceReview < runtimeConfig.toolCallThreshold) {
      return;
    }

    this.inFlightSessionIds.add(event.sessionId);
    try {
      const reviewSession = await this.config.sessionRequester.spawnSessionAndRequest({
        sourceSessionId: event.sessionId,
        sourceSessionMetadata: session.metadata,
        metadataOverrides: {
          requested_skills: LEARNING_LOOP_REQUESTED_SKILLS,
          [LEARNING_LOOP_DISABLED_METADATA_KEY]: true,
          [LEARNING_LOOP_SOURCE_SESSION_ID_METADATA_KEY]: event.sessionId,
        },
        parentSessionId: event.sessionId,
        notify: "none",
        title: this.buildReviewTitle(session.metadata),
        task: buildLearningLoopTask({
          sessionId: event.sessionId,
          toolCallsSinceReview,
          currentToolCallCount: totalToolCalls,
        }),
      });
      const nextMetadata: Record<string, unknown> = {
        ...session.metadata,
        [LEARNING_LOOP_LAST_TOOL_CALL_COUNT_METADATA_KEY]: totalToolCalls,
        [LEARNING_LOOP_LAST_REQUESTED_AT_METADATA_KEY]: new Date().toISOString(),
        [LEARNING_LOOP_LAST_REVIEW_SESSION_ID_METADATA_KEY]:
          reviewSession.sessionId,
      };
      session.metadata = nextMetadata;
      this.config.sessionStore.save(session);
    } finally {
      this.inFlightSessionIds.delete(event.sessionId);
    }
  };

  private readRuntimeConfig = () => {
    if (this.config.resolveRuntimeConfig) {
      return this.config.resolveRuntimeConfig();
    }
    return {
      enabled: true,
      toolCallThreshold:
        this.config.toolCallThreshold ?? DEFAULT_LEARNING_LOOP_TOOL_CALL_THRESHOLD,
    };
  };

  private buildReviewTitle = (metadata: Record<string, unknown>): string => {
    const label = readSessionLabel(metadata);
    return label ? `Learning loop: ${label}` : "Learning loop";
  };
}
