import { describe, expect, it } from "vitest";
import {
  createAssistantStreamDeltaControlMessage,
  createAssistantStreamResetControlMessage,
  createTypingStopControlMessage,
  isAssistantStreamResetControlMessage,
  isNextclawControlMessage,
  isTypingStopControlMessage,
  NEXTCLAW_CONTROL_METADATA_KEY,
  readAssistantStreamDelta
} from "./control.js";
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

  it("creates assistant stream reset control message", () => {
    const inbound: InboundMessage = {
      channel: "telegram",
      senderId: "u-2",
      chatId: "c-2",
      content: "hello",
      timestamp: new Date(),
      attachments: [],
      metadata: { message_id: 1234 }
    };
    const outbound = createAssistantStreamResetControlMessage(inbound);
    expect(outbound.channel).toBe("telegram");
    expect(outbound.chatId).toBe("c-2");
    expect(isAssistantStreamResetControlMessage(outbound)).toBe(true);
    expect(isNextclawControlMessage(outbound)).toBe(true);
    expect(outbound.metadata[NEXTCLAW_CONTROL_METADATA_KEY]).toEqual({
      type: "assistant_stream",
      action: "reset"
    });
  });

  it("creates assistant stream delta control message and reads delta", () => {
    const inbound: InboundMessage = {
      channel: "telegram",
      senderId: "u-3",
      chatId: "c-3",
      content: "hello",
      timestamp: new Date(),
      attachments: [],
      metadata: {}
    };
    const outbound = createAssistantStreamDeltaControlMessage(inbound, " partial ");
    expect(isNextclawControlMessage(outbound)).toBe(true);
    expect(readAssistantStreamDelta(outbound)).toBe(" partial ");
  });
});
