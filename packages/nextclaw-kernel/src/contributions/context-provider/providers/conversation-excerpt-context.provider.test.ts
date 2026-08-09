import { describe, expect, it } from "vitest";
import {
  CHAT_CONVERSATION_EXCERPT_TOKEN_KIND,
  CHAT_INLINE_TOKENS_METADATA_KEY,
  CHAT_INLINE_TOKENS_SCHEMA_VERSION,
} from "@nextclaw/shared";
import type { AgentRunRequest } from "@kernel/types/agent-run.types.js";
import { ConversationExcerptContextProvider } from "./conversation-excerpt-context.provider.js";

describe("ConversationExcerptContextProvider", () => {
  it("injects the selected message snapshot with its source identity", () => {
    const request = {
      message: {
        id: "message-1",
        sessionId: "session-1",
        role: "user",
        parts: [{ type: "text", text: "Please continue" }],
        metadata: {
          [CHAT_INLINE_TOKENS_METADATA_KEY]: {
            schemaVersion: CHAT_INLINE_TOKENS_SCHEMA_VERSION,
            items: [{
              kind: CHAT_CONVERSATION_EXCERPT_TOKEN_KIND,
              key: "assistant-1#excerpt-demo",
              messageId: "assistant-1",
              role: "assistant",
              label: "AI reply",
              excerpt: "Keep the visible tag concise.",
              rawText: "@message-excerpt:assistant-1%23excerpt-demo",
            }],
          },
        },
      },
    } as AgentRunRequest;

    const context = new ConversationExcerptContextProvider().provide(request).join("\n");

    expect(context).toContain("## Explicit Conversation Excerpts");
    expect(context).toContain(
      '<conversation_excerpt message_id="assistant-1" role="assistant" label="AI reply">',
    );
    expect(context).toContain("Keep the visible tag concise.");
    expect(context).toContain("quoted conversation data");
  });
});
