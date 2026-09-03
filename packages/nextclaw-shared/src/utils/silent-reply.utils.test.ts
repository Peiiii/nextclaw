import { describe, expect, it } from "vitest";
import type { NcpMessage } from "@nextclaw/ncp";
import {
  containsSilentReplyMarker,
  isSilentReplyNcpMessage,
} from "./silent-reply.utils.js";

describe("silent reply contract", () => {
  it("recognizes only a standalone marker with flexible whitespace", () => {
    expect(containsSilentReplyMarker("\n < noreply / >\t")).toBe(true);
    expect(containsSilentReplyMarker("\\n\\n<noreply/>")).toBe(true);
    expect(containsSilentReplyMarker("before <noreply/> after")).toBe(false);
    expect(containsSilentReplyMarker("Use `<noreply/>` when idle.")).toBe(false);
  });

  it("recognizes the marker as the complete visible assistant text", () => {
    const silentMessage: NcpMessage = {
      id: "assistant-1",
      sessionId: "session-1",
      role: "assistant",
      status: "final",
      timestamp: "2026-08-07T00:00:00.000Z",
      parts: [{ type: "text", text: "\n\n<noreply/>" }],
    };

    expect(isSilentReplyNcpMessage(silentMessage)).toBe(true);
    expect(isSilentReplyNcpMessage({
      ...silentMessage,
      parts: [
        ...silentMessage.parts,
        {
          type: "tool-invocation",
          toolCallId: "call-1",
          toolName: "message",
          state: "result",
        },
      ],
    })).toBe(true);
    expect(isSilentReplyNcpMessage({
      ...silentMessage,
      parts: [
        { type: "text", text: "Empty runs return " },
        { type: "rich-text", text: "`<noreply/>`." },
      ],
    })).toBe(false);
  });
});
