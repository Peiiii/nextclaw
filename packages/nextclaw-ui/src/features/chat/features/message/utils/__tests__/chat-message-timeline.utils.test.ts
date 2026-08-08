import { describe, expect, it } from "vitest";
import {
  NCP_INTERNAL_VISIBILITY_METADATA_KEY,
  type NcpMessage,
} from "@nextclaw/ncp";
import { isVisibleChatMessage } from "@/features/chat/features/message/utils/chat-message-timeline.utils";

const visibleMessage = {
  id: "assistant-visible",
  sessionId: "session-1",
  role: "assistant",
  status: "final",
  timestamp: "2026-08-07T00:00:00.000Z",
  parts: [{ type: "text", text: "visible" }],
} satisfies NcpMessage;

describe("chat message timeline visibility", () => {
  it("hides internal and legacy silent messages", () => {
    expect(isVisibleChatMessage({
      ...visibleMessage,
      metadata: { [NCP_INTERNAL_VISIBILITY_METADATA_KEY]: "hidden" },
    })).toBe(false);
    expect(isVisibleChatMessage({
      ...visibleMessage,
      parts: [{ type: "text", text: "\\n\\n<noreply/>" }],
    })).toBe(false);
    expect(isVisibleChatMessage(visibleMessage)).toBe(true);
  });
});
