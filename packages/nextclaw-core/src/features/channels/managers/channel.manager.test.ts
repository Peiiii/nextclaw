import { describe, expect, it } from "vitest";
import {
  isNextclawControlMessage,
  MessageBus,
  NEXTCLAW_CONTROL_METADATA_KEY,
  type OutboundMessage
} from "@core/features/bus/index.js";
import type { Config } from "@core/features/config/index.js";
import type { ExtensionChannelRegistration } from "@core/features/extensions/index.js";
import { ChannelManager } from "./channel.manager.js";

describe("ChannelManager", () => {
  const createManager = () => {
    const bus = new MessageBus();
    const manager = new ChannelManager({ bus });
    return { bus, manager };
  };

  const createRegistration = (channelId: string): ExtensionChannelRegistration => ({
    extensionId: `extension-${channelId}`,
    source: "test",
    channel: {
      id: channelId,
      outbound: {
        sendText: () => undefined,
      },
    },
  });

  it("loads extension channels and routes outbound/control messages through the same owner", async () => {
    const { manager } = createManager();
    const sent: OutboundMessage[] = [];
    manager.load({
      channelConfig: {} as Config,
      extensionChannels: [{
        extensionId: "extension-test",
        source: "test",
        channel: {
          id: "test",
          outbound: {
            sendText: ({ to, text, media, metadata, replyTo }) => {
              sent.push({
                channel: "test",
                chatId: to,
                content: text,
                ...(replyTo !== undefined ? { replyTo } : {}),
                media: media ?? [],
                metadata: metadata ?? {},
              });
            },
          },
        },
      }],
    });

    await manager.start();
    await manager.deliver({
      channel: "test",
      chatId: "chat",
      content: "hello",
      media: [],
      metadata: {},
    });
    await manager.deliver({
      channel: "test",
      chatId: "chat",
      content: "",
      media: [],
      metadata: {
        [NEXTCLAW_CONTROL_METADATA_KEY]: {
          type: "typing",
          action: "stop",
        },
      },
    });

    expect(manager.enabledChannels).toEqual(["test"]);
    expect(manager.status()).toEqual({ test: { enabled: true, running: true } });
    expect(sent.map((message) => message.content)).toEqual(["hello", ""]);
    expect(isNextclawControlMessage(sent[1] as OutboundMessage)).toBe(true);

    await manager.stop();
    expect(manager.status()).toEqual({ test: { enabled: true, running: false } });
  });

  it("routes generic extension outbound text handlers", async () => {
    const { manager } = createManager();
    const sent: Array<{
      cfg: Config;
      to: string;
      text: string;
      accountId?: string | null;
      replyTo?: string | null;
      media?: string[];
      metadata?: Record<string, unknown>;
    }> = [];
    manager.load({
      channelConfig: {} as Config,
      extensionChannels: [{
        extensionId: "extension-test",
        source: "test",
        channel: {
          id: "test",
          outbound: {
            sendText: (message) => {
              sent.push(message);
            },
          },
        },
      }],
    });

    await manager.start();
    await manager.deliver({
      channel: "test",
      chatId: "chat-1",
      content: "hello",
      replyTo: "message-1",
      media: ["asset-1"],
      metadata: {
        accountId: "account-1",
        qq: {
          messageType: "group",
          groupId: "group-1",
          userId: "user-1",
        },
      },
    });

    expect(sent).toEqual([{
      cfg: {},
      to: "chat-1",
      text: "hello",
      accountId: "account-1",
      replyTo: "message-1",
      media: ["asset-1"],
      metadata: {
        accountId: "account-1",
        qq: {
          messageType: "group",
          groupId: "group-1",
          userId: "user-1",
        },
      },
    }]);
    await manager.stop();
  });

  it("drains generic extension NCP reply streams without legacy outbound delivery", async () => {
    const { manager } = createManager();
    const sent: string[] = [];
    let drained = 0;
    manager.load({
      channelConfig: {} as Config,
      extensionChannels: [{
        extensionId: "extension-test",
        source: "test",
        channel: {
          id: "test",
          outbound: {
            sendText: ({ text }) => {
              sent.push(text);
            },
          },
        },
      }],
    });

    const channel = manager.getChannel("test") as {
      consumeNcpReply?: (input: { eventStream: AsyncIterable<unknown> }) => Promise<void>;
    } | null;
    await channel?.consumeNcpReply?.({
      eventStream: (async function* () {
        yield { type: "message.completed" };
        drained += 1;
      })(),
    });

    expect(drained).toBe(1);
    expect(sent).toEqual([]);
  });

  it("fails explicitly when a generic extension channel has no outbound handler", async () => {
    const { manager } = createManager();
    manager.load({
      channelConfig: {} as Config,
      extensionChannels: [{
        extensionId: "extension-test",
        source: "test",
        channel: {
          id: "test",
        },
      }],
    });

    await manager.start();
    await expect(manager.deliver({
      channel: "test",
      chatId: "chat-1",
      content: "hello",
      media: [],
      metadata: {},
    })).rejects.toThrow("extension channel 'test' outbound handler is not configured");
    await manager.stop();
  });

  it("reloads channel state in place and restarts only when requested", async () => {
    const { manager } = createManager();

    manager.load({
      channelConfig: {} as Config,
      extensionChannels: [createRegistration("first")],
    });
    await manager.start();
    await manager.reload({
      channelConfig: {} as Config,
      extensionChannels: [createRegistration("second")],
      start: true,
    });

    expect(manager.getChannel("first")).toBeNull();
    expect(manager.getChannel("second")).toBeTruthy();
    expect(manager.status()).toEqual({ second: { enabled: true, running: true } });

    await manager.stop();
  });
});
