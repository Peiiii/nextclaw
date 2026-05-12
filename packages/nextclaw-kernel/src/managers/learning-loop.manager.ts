import {
  type Session,
  type SessionManager,
  type SessionMessage,
  type SessionRequestToolResult,
  type SpawnSessionAndRequestParams,
} from "@nextclaw/core";
import type { EventBus } from "@nextclaw/shared";
import { agentRunFinishedLifecycleEventKey } from "@kernel/configs/ncp-lifecycle-event.config.js";
import type { AgentRunFinishedLifecycleEvent } from "@kernel/types/ncp-lifecycle-event.types.js";
import {
  DEFAULT_LEARNING_LOOP_TOOL_CALL_THRESHOLD,
  LEARNING_LOOP_DISABLED_METADATA_KEY,
  LEARNING_LOOP_LAST_REQUESTED_AT_METADATA_KEY,
  LEARNING_LOOP_LAST_REVIEW_SESSION_ID_METADATA_KEY,
  LEARNING_LOOP_LAST_TOOL_CALL_COUNT_METADATA_KEY,
  LEARNING_LOOP_REQUESTED_SKILLS,
  LEARNING_LOOP_SOURCE_SESSION_ID_METADATA_KEY,
  type LearningLoopRuntimeConfig,
} from "@kernel/configs/learning-loop.config.js";
import { buildLearningLoopTask } from "@kernel/utils/learning-loop-prompt.utils.js";

export type LearningLoopSessionRequester = {
  spawnSessionAndRequest: (
    params: SpawnSessionAndRequestParams,
  ) => Promise<SessionRequestToolResult>;
};

type LearningLoopSessionStore = Pick<
  SessionManager,
  "getIfExists" | "save"
>;

export type LearningLoopManagerOptions = {
  eventBus: EventBus;
  sessionManager: SessionManager;
  sessionRequester: LearningLoopSessionRequester;
  resolveLearningLoopConfig?: () => LearningLoopRuntimeConfig;
};

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

export class LearningLoopManager {
  private readonly sessionStore: LearningLoopSessionStore;
  private readonly inFlightSessionIds = new Set<string>();
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly options: LearningLoopManagerOptions) {
    this.sessionStore = options.sessionManager;
  }

  start = (): void => {
    if (this.unsubscribe) {
      return;
    }
    this.unsubscribe = this.options.eventBus.on(
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
    const session = this.sessionStore.getIfExists(event.sessionId);
    if (!session) {
      return;
    }
    const runtimeConfig = this.readRuntimeConfig();
    if (!runtimeConfig.enabled || isLearningLoopDisabled(session.metadata)) {
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
      const reviewSession = await this.options.sessionRequester.spawnSessionAndRequest({
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
      this.sessionStore.save(session);
    } finally {
      this.inFlightSessionIds.delete(event.sessionId);
    }
  };

  private readRuntimeConfig = (): LearningLoopRuntimeConfig => {
    return this.options.resolveLearningLoopConfig?.() ?? {
      enabled: true,
      toolCallThreshold: DEFAULT_LEARNING_LOOP_TOOL_CALL_THRESHOLD,
    };
  };

  private buildReviewTitle = (metadata: Record<string, unknown>): string => {
    const label = readSessionLabel(metadata);
    return label ? `Learning loop: ${label}` : "Learning loop";
  };
}
