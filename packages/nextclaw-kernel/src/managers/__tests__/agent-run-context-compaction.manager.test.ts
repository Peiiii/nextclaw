import { describe, expect, it, vi } from "vitest";
import {
  CONTEXT_COMPACTION_METADATA_KEY,
  type ContextCompactionCheckpoint,
} from "@nextclaw/core";
import type { NcpMessage } from "@nextclaw/ncp";
import { buildContextCompactionTimelineNcpMessage } from "@kernel/features/context-compaction/index.js";
import { AgentRunContextCompactionManager } from "@kernel/managers/agent-run-context-compaction.manager.js";
import type { AgentManager } from "@kernel/managers/agent.manager.js";

const SESSION_ID = "session-context-compaction";

function createAgentManager(): AgentManager {
  return {
    resolveAgentProfileForRun: () => ({
      id: "main",
      default: true,
      workspace: "",
      model: "agent-default-model",
      contextTokens: 1_000,
      reservedContextTokens: 0,
      displayName: "Main",
      builtIn: true,
    }),
  } as AgentManager;
}

function createMessage(params: {
  id: string;
  role: "assistant" | "user";
  text: string;
  timestamp: string;
}): NcpMessage {
  const { id, role, text, timestamp } = params;
  return {
    id,
    sessionId: SESSION_ID,
    role,
    status: "final",
    timestamp,
    parts: [{ type: "text", text }],
  };
}

function createFirstCompactionMessages(): NcpMessage[] {
  return [
    createMessage({
      id: "large-previous-reply",
      role: "assistant",
      text: "chapter ".repeat(3_000),
      timestamp: "2026-07-16T01:00:00.000Z",
    }),
    createMessage({
      id: "current-user-message",
      role: "user",
      text: "continue",
      timestamp: "2026-07-16T01:01:00.000Z",
    }),
  ];
}

function createExistingCheckpoint(): ContextCompactionCheckpoint {
  return {
    version: 1,
    id: "ctx-existing",
    status: "compressed",
    summary: "Previously compressed context.",
    coveredUntil: "2026-07-16T01:00:00.000Z",
    coveredMessageCount: 8,
    coveredSessionMessageCount: 8,
    originalEstimatedTokens: 900,
    projectedEstimatedTokens: 100,
    createdAt: "2026-07-16T01:00:00.000Z",
    updatedAt: "2026-07-16T01:00:00.000Z",
  };
}

function createManager(providerManager: object, patchSessionMetadata = vi.fn()) {
  return {
    manager: new AgentRunContextCompactionManager(
      createAgentManager(),
      providerManager as never,
      { patchSessionMetadata } as never,
    ),
    patchSessionMetadata,
  };
}

describe("AgentRunContextCompactionManager", () => {
  it("manually compacts history below the automatic budget threshold", async () => {
    const providerManager = {
      chat: vi.fn(async () => ({ content: "# Compressed Working Context\n\nManual." })),
    };
    const { manager } = createManager(providerManager);
    const messages = [
      createMessage({
        id: "older-message",
        role: "assistant",
        text: "Short prior answer.",
        timestamp: "2026-07-16T01:00:00.000Z",
      }),
      createMessage({
        id: "current-message",
        role: "user",
        text: "Continue.",
        timestamp: "2026-07-16T01:01:00.000Z",
      }),
    ];

    await expect(manager.runPreflight({
      agentId: "main",
      contextBlocks: [],
      messages,
      metadata: {},
      model: "run-selected-model",
      sessionId: SESSION_ID,
    })).resolves.toEqual([]);
    await expect(manager.runManual({
      agentId: "main",
      contextBlocks: [],
      messages,
      metadata: {},
      model: "run-selected-model",
      sessionId: SESSION_ID,
    })).resolves.toHaveLength(1);
  });

  it("uses the run-selected model and only persists the completed checkpoint", async () => {
    const providerManager = {
      chat: vi.fn(async () => ({ content: "# Compressed Working Context\n\nContinue." })),
    };
    const { manager, patchSessionMetadata } = createManager(providerManager);

    const events = await manager.runPreflight({
      agentId: "main",
      contextBlocks: ["runtime context ".repeat(4_000)],
      messages: createFirstCompactionMessages(),
      metadata: {},
      model: "run-selected-model",
      sessionId: SESSION_ID,
    });

    expect(providerManager.chat).toHaveBeenCalledWith(expect.objectContaining({
      model: "run-selected-model",
    }));
    expect(patchSessionMetadata).toHaveBeenCalledOnce();
    expect(patchSessionMetadata).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({
        [CONTEXT_COMPACTION_METADATA_KEY]: expect.objectContaining({ status: "compressed" }),
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.payload).toMatchObject({
      message: {
        metadata: {
          checkpoint: { status: "compressed" },
        },
      },
    });
  });

  it("does not persist a checkpoint when the first compaction fails", async () => {
    const providerManager = {
      chat: vi.fn(async () => {
        throw new Error("provider failed");
      }),
    };
    const { manager, patchSessionMetadata } = createManager(providerManager);

    await expect(manager.runPreflight({
      agentId: "main",
      contextBlocks: ["runtime context ".repeat(4_000)],
      messages: createFirstCompactionMessages(),
      metadata: {},
      model: "run-selected-model",
      sessionId: SESSION_ID,
    })).rejects.toThrow("provider failed");

    expect(patchSessionMetadata).not.toHaveBeenCalled();
  });

  it("preserves the previous checkpoint when rolling compaction fails", async () => {
    const checkpoint = createExistingCheckpoint();
    const metadata = { [CONTEXT_COMPACTION_METADATA_KEY]: checkpoint };
    const providerManager = {
      chat: vi.fn(async () => {
        throw new Error("provider failed");
      }),
    };
    const { manager, patchSessionMetadata } = createManager(providerManager);
    const messages = [
      buildContextCompactionTimelineNcpMessage({
        checkpoint,
        messageId: "existing-compaction-message",
        sessionId: SESSION_ID,
      }),
      ...Array.from({ length: 16 }, (_, index) => createMessage({
        id: `message-after-${index}`,
        role: "user",
        text: `after checkpoint ${index} ${"x".repeat(480)}`,
        timestamp: `2026-07-16T01:${String(index + 2).padStart(2, "0")}:00.000Z`,
      })),
    ];

    await expect(manager.runPreflight({
      agentId: "main",
      contextBlocks: [],
      messages,
      metadata,
      model: "run-selected-model",
      sessionId: SESSION_ID,
    })).rejects.toThrow("provider failed");

    expect(patchSessionMetadata).not.toHaveBeenCalled();
    expect(metadata[CONTEXT_COMPACTION_METADATA_KEY]).toEqual(checkpoint);
  });

  it("recovers on retry without persisting the failed attempt", async () => {
    const providerManager = {
      chat: vi.fn()
        .mockRejectedValueOnce(new Error("provider failed"))
        .mockResolvedValueOnce({ content: "# Compressed Working Context\n\nRecovered." }),
    };
    const { manager, patchSessionMetadata } = createManager(providerManager);
    const input = {
      agentId: "main",
      contextBlocks: ["runtime context ".repeat(4_000)],
      messages: createFirstCompactionMessages(),
      metadata: {},
      model: "run-selected-model",
      sessionId: SESSION_ID,
    };

    await expect(manager.runPreflight(input)).rejects.toThrow("provider failed");
    await expect(manager.runPreflight(input)).resolves.toHaveLength(1);

    expect(patchSessionMetadata).toHaveBeenCalledOnce();
    expect(patchSessionMetadata).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({
        [CONTEXT_COMPACTION_METADATA_KEY]: expect.objectContaining({ status: "compressed" }),
      }),
    );
  });
});
