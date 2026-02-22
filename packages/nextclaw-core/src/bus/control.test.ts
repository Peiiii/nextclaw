import { describe, expect, it } from "vitest";
import { createTypingStopControlMessage, isTypingStopControlMessage, NEXTCLAW_CONTROL_METADATA_KEY } from "./control.js";
import type { InboundMessage } from "./events.js";

describe("typing control message helpers", () => {
  it("creates typing-stop control message from inbound", () => {
    const inbound: InboundMessage = {
      channel: "discord",
      senderId: "u-1",
      chatId: "c-1",
      content: "hello",
      timestamp: new Date(),
      attachments: [],
      metadata: {
        account_id: "default"
      }
    };

    const outbound = createTypingStopControlMessage(inbound);

    expect(outbound.channel).toBe("discord");
    expect(outbound.chatId).toBe("c-1");
    expect(outbound.content).toBe("");
    expect(outbound.media).toEqual([]);
    expect(outbound.metadata.account_id).toBe("default");
    expect(outbound.metadata[NEXTCLAW_CONTROL_METADATA_KEY]).toEqual({
      type: "typing",
      action: "stop"
    });
    expect(isTypingStopControlMessage(outbound)).toBe(true);
  });

  it("returns false for non-control outbound message", () => {
    expect(
      isTypingStopControlMessage({
        metadata: {
          silent: true
        }
      })
    ).toBe(false);
  });
});
