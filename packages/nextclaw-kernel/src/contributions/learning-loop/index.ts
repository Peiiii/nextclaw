import {
  readParentSessionId,
  type Session,
  type SessionManager,
  type SessionMessage,
  type SessionRequestToolResult,
  type SpawnSessionAndRequestParams,
} from "@nextclaw/core";
import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import { eventKeys, type Unsubscribe } from "@nextclaw/shared";
import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import {
  LEARNING_LOOP_DISABLED_METADATA_KEY,
  LEARNING_LOOP_LAST_REQUESTED_AT_METADATA_KEY,
  LEARNING_LOOP_LAST_REVIEW_SESSION_ID_METADATA_KEY,
  LEARNING_LOOP_LAST_TOOL_CALL_COUNT_METADATA_KEY,
  LEARNING_LOOP_REQUESTED_SKILLS,
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
  "getIfExists" | "save"
>;

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

function readRunFinishedSessionId(event: NcpEndpointEvent): string | null {
  if (event.type !== NcpEventType.RunFinished) {
    return null;
  }
  return event.payload.sessionId?.trim() || null;
}

export class LearningLoopContribution implements KernelContribution {
  private readonly sessionStore: LearningLoopSessionStore;
  private readonly sessionRequester: LearningLoopSessionRequester;
  private readonly inFlightSessionIds = new Set<string>();
  private unsubscribe: Unsubscribe | null = null;

  constructor(private readonly kernel: NextclawKernel) {
    this.sessionStore = kernel.sessions;
    this.sessionRequester = kernel.sessionRequests;
  }

  start = (): void => {
    if (this.unsubscribe) {
      return;
    }
    this.unsubscribe = this.kernel.eventBus.on(eventKeys.ncpEvent, this.handleNcpEvent);
  };

  dispose = (): void => {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.inFlightSessionIds.clear();
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
    const session = this.sessionStore.getIfExists(sessionId);
    if (!session || readParentSessionId(session.metadata)) {
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

    this.inFlightSessionIds.add(sessionId);
    try {
      const reviewSession = await this.sessionRequester.spawnSessionAndRequest({
        sourceSessionId: sessionId,
        updateToolCallResult: async () => undefined,
        sourceSessionMetadata: session.metadata,
        metadataOverrides: {
          requested_skills: LEARNING_LOOP_REQUESTED_SKILLS,
          [LEARNING_LOOP_DISABLED_METADATA_KEY]: true,
          [LEARNING_LOOP_SOURCE_SESSION_ID_METADATA_KEY]: sessionId,
        },
        parentSessionId: sessionId,
        notify: "none",
        title: this.buildReviewTitle(session.metadata),
        task: buildLearningLoopTask({
          sessionId,
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
