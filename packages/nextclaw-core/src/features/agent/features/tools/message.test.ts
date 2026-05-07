import { describe, expect, it, vi } from "vitest";
import { MessageTool } from "./message.js";

describe("MessageTool", () => {
  it("treats missing content aliases as invalid parameters", async () => {
    const sendCallback = vi.fn().mockResolvedValue(undefined);
    const tool = new MessageTool(sendCallback);
    tool.setContext("feishu", "ou_current", "default");

    expect(tool.validateParams({})).toEqual(["missing required content or message"]);
    expect(tool.validateParams({ message: "   " })).toEqual(["missing required content or message"]);
  });

  it("reuses the current conversation when target is omitted in the same channel", async () => {
    const sendCallback = vi.fn().mockResolvedValue(undefined);
    const tool = new MessageTool(sendCallback);
    tool.setContext("feishu", "ou_current", "default");

    const result = await tool.execute({
      channel: "feishu",
      message: "hello",
    });

    expect(result).toBe("Message sent to feishu:ou_current");
    expect(sendCallback).toHaveBeenCalledWith({
      channel: "feishu",
      chatId: "ou_current",
      content: "hello",
      replyTo: undefined,
      media: [],
      metadata: {
        accountId: "default",
        account_id: "default",
      },
    });
  });

  it("rejects cross-channel sends without an explicit target", async () => {
    const sendCallback = vi.fn().mockResolvedValue(undefined);
    const tool = new MessageTool(sendCallback);
    tool.setContext("ui", "web-ui");

    expect(tool.validateParams({
      channel: "feishu",
      message: "hello",
    })).toEqual(["missing required to or chatId when channel differs from current session (ui:web-ui)"]);

    const result = await tool.execute({
      channel: "feishu",
      message: "hello",
    });

    expect(result).toBe("Error: missing required to or chatId when channel differs from current session (ui:web-ui)");
    expect(sendCallback).not.toHaveBeenCalled();
  });
});
