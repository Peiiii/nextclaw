import { describe, expect, it } from "vitest";
import type { NcpMessage } from "@nextclaw/ncp";
import {
  CHAT_CONTINUATION_TARGET_MESSAGE_METADATA_KEY,
} from "@nextclaw/shared";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import { ContextCompactionPreflightService } from "./context-compaction-preflight.service.js";
import { MODEL_ROUND_PART_OFFSETS, ncpMessageToOpenAiMessages } from "@nextclaw/ncp-agent-runtime";
import { buildContextCompactionModelProjection, buildContextCompactionTimelineNcpMessage } from "../utils/context-compaction.utils.js";

const SESSION_ID = "session-pre-run-placement";

function createService(): ContextCompactionPreflightService {
  const agentManager = {
    resolveAgentProfileForRun: () => ({
      id: "main",
      default: true,
      workspace: "",
      model: "test-model",
      contextTokens: 1_000,
      reservedContextTokens: 0,
      displayName: "Main",
      builtIn: true,
    }),
  } as AgentManager;
  return new ContextCompactionPreflightService(agentManager, {} as never);
}

describe("continuation pre-run compaction placement", () => {
  it("projects only retained parts and rebases later model rounds without changing the journal", () => {
    const assistant: NcpMessage = { id: "reply", sessionId: SESSION_ID, role: "assistant", status: "final",
      timestamp: "2026-08-08T10:00:00.000Z",
      parts: [{ type: "text", text: "covered history" }, { type: "text", text: "retained" }, { type: "text", text: "later" }],
      metadata: { [MODEL_ROUND_PART_OFFSETS]: [1, 2] } };
    const marker = buildContextCompactionTimelineNcpMessage({ sessionId: SESSION_ID, messageId: "checkpoint", checkpoint: {
      version: 1, id: "checkpoint", status: "compressed", summary: "Earlier work summarized.",
      retainedMessageIds: ["reply"], retainedMessagePartStarts: { reply: 1 },
      coveredMessageCount: 1, coveredSessionMessageCount: 1, originalEstimatedTokens: 100, projectedEstimatedTokens: 20,
      createdAt: "2026-08-08T11:00:00.000Z", updatedAt: "2026-08-08T11:00:00.000Z",
    } });
    const projected = buildContextCompactionModelProjection({ sessionId: SESSION_ID, sessionMessages: [assistant, marker] });
    const tail = projected.messages.find((message) => message.id === "reply")!;
    expect(ncpMessageToOpenAiMessages(tail).map((message) => message.content)).toEqual(["retained", "later"]);
    expect(tail.metadata?.[MODEL_ROUND_PART_OFFSETS]).toEqual([1]);
    expect(assistant.parts).toHaveLength(3);
    expect(assistant.metadata?.[MODEL_ROUND_PART_OFFSETS]).toEqual([1, 2]);
  });

  it("persists the target assistant part boundary before summary generation", () => {
    const targetAssistant: NcpMessage = {
      id: "assistant-target",
      sessionId: SESSION_ID,
      role: "assistant",
      status: "error",
      timestamp: "2026-08-08T11:00:00.000Z",
      parts: [
        { type: "text", text: "x".repeat(4_000) },
        { type: "reasoning", text: "finished reasoning" },
      ],
    };
    const continuationPrompt: NcpMessage = {
      id: "continuation-prompt",
      sessionId: SESSION_ID,
      role: "user",
      status: "final",
      timestamp: "2026-08-08T11:01:00.000Z",
      parts: [{ type: "text", text: "Continue." }],
      metadata: {
        [CHAT_CONTINUATION_TARGET_MESSAGE_METADATA_KEY]: targetAssistant.id,
      },
    };

    const result = createService().begin({
      inputMessages: [],
      model: "test-model",
      phase: "pre-run",
      requestMetadata: {},
      sessionId: SESSION_ID,
      sessionMessages: [targetAssistant, continuationPrompt],
      storedAgentId: "main",
      storedMetadata: {},
    });

    expect(result.pendingCompaction?.checkpoint).toMatchObject({
      phase: "pre-run",
      continuationMessageId: targetAssistant.id,
      continuationMessageCoveredPartCount: targetAssistant.parts.length,
      status: "compressing",
    });
  });
});
