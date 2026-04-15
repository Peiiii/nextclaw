import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGlobalTypedEventBus,
  SessionManager,
} from "@nextclaw/core";
import { LearningReviewFeature } from "./learning-review-feature.service.js";
import { agentRunFinishedLifecycleEventKey } from "../lifecycle-events/ncp-lifecycle-event.config.js";
import {
  LEARNING_REVIEW_DISABLED_METADATA_KEY,
  LEARNING_REVIEW_LAST_REVIEW_SESSION_ID_METADATA_KEY,
  LEARNING_REVIEW_LAST_TOOL_CALL_COUNT_METADATA_KEY,
} from "./learning-review.config.js";

const tempDirs: string[] = [];

function createSessionManager(): SessionManager {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-learning-review-"));
  tempDirs.push(dir);
  return new SessionManager({
    sessionsDir: dir,
  });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("LearningReviewFeature", () => {
  it("spawns a review child session after enough tool calls", async () => {
    const eventBus = createGlobalTypedEventBus();
    const sessionStore = createSessionManager();
    const session = sessionStore.getOrCreate("root-session");
    session.metadata = {
      label: "Investigate deploy issue",
    };
    session.messages.push({
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      tool_calls: [{ id: "call-1" }, { id: "call-2" }],
    });
    sessionStore.save(session);
    const spawnSessionAndRequest = vi.fn().mockResolvedValue({
      sessionId: "review-session-1",
    });
    const feature = new LearningReviewFeature({
      eventBus,
      sessionStore,
      sessionRequester: {
        spawnSessionAndRequest,
      },
      toolCallThreshold: 2,
    });

    feature.start();
    eventBus.emit(agentRunFinishedLifecycleEventKey, {
      sessionId: "root-session",
      isChildSession: false,
      emittedAt: new Date().toISOString(),
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(spawnSessionAndRequest).toHaveBeenCalledTimes(1);
    expect(spawnSessionAndRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceSessionId: "root-session",
        parentSessionId: "root-session",
        notify: "none",
        metadataOverrides: expect.objectContaining({
          requested_skills: ["skill-creator"],
          [LEARNING_REVIEW_DISABLED_METADATA_KEY]: true,
        }),
      }),
    );
    expect(
      sessionStore.getIfExists("root-session")?.metadata[
        LEARNING_REVIEW_LAST_TOOL_CALL_COUNT_METADATA_KEY
      ],
    ).toBe(2);
    expect(
      sessionStore.getIfExists("root-session")?.metadata[
        LEARNING_REVIEW_LAST_REVIEW_SESSION_ID_METADATA_KEY
      ],
    ).toBe("review-session-1");
  });

  it("skips child sessions and disabled sessions", async () => {
    const eventBus = createGlobalTypedEventBus();
    const sessionStore = createSessionManager();
    const session = sessionStore.getOrCreate("root-session");
    session.metadata = {
      [LEARNING_REVIEW_DISABLED_METADATA_KEY]: true,
    };
    session.messages.push({
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      tool_calls: [{ id: "call-1" }, { id: "call-2" }],
    });
    sessionStore.save(session);
    const spawnSessionAndRequest = vi.fn();
    const feature = new LearningReviewFeature({
      eventBus,
      sessionStore,
      sessionRequester: {
        spawnSessionAndRequest,
      },
      toolCallThreshold: 1,
    });

    feature.start();
    eventBus.emit(agentRunFinishedLifecycleEventKey, {
      sessionId: "root-session",
      isChildSession: false,
      emittedAt: new Date().toISOString(),
    });
    eventBus.emit(agentRunFinishedLifecycleEventKey, {
      sessionId: "child-session",
      isChildSession: true,
      emittedAt: new Date().toISOString(),
    });

    await Promise.resolve();
    expect(spawnSessionAndRequest).not.toHaveBeenCalled();
  });
});
