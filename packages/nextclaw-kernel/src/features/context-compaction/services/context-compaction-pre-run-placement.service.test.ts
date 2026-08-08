import { describe, expect, it } from "vitest";
import type { NcpMessage } from "@nextclaw/ncp";
import {
  CHAT_CONTINUATION_TARGET_MESSAGE_METADATA_KEY,
} from "@nextclaw/shared";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import { ContextCompactionPreflightService } from "./context-compaction-preflight.service.js";

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
