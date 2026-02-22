import { describe, expect, it } from "vitest";
import type { Config } from "../config/schema.js";
import type { OutboundMessage, InboundMessage } from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
import { createTypingStopControlMessage } from "../bus/control.js";
import { ChannelManager } from "./manager.js";
import { BaseChannel } from "./base.js";
import type { ExtensionChannelRegistration } from "../extensions/types.js";

class MockChannel extends BaseChannel<Record<string, unknown>> {
  name = "discord";
  sent: OutboundMessage[] = [];
  controls: OutboundMessage[] = [];

  async start(): Promise<void> {
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async send(msg: OutboundMessage): Promise<void> {
    this.sent.push(msg);
  }

  override async handleControlMessage(msg: OutboundMessage): Promise<boolean> {
    this.controls.push(msg);
    return true;
  }
}

describe("ChannelManager typing control", () => {
  it("routes typing control to handleControlMessage and skips send", async () => {
    const bus = new MessageBus();
    const mockChannel = new MockChannel({}, bus);
    const registration: ExtensionChannelRegistration = {
      extensionId: "mock",
      source: "test",
      channel: {
        id: "discord",
        nextclaw: {
          createChannel: () => mockChannel
        }
      }
    };
    const manager = new ChannelManager({} as Config, bus, undefined, [registration]);

    const inbound: InboundMessage = {
      channel: "discord",
      senderId: "user-1",
      chatId: "room-1",
      content: "hello",
      timestamp: new Date(),
      attachments: [],
      metadata: {}
    };
    const delivered = await manager.deliver(createTypingStopControlMessage(inbound));

    expect(delivered).toBe(true);
    expect(mockChannel.controls).toHaveLength(1);
    expect(mockChannel.sent).toHaveLength(0);
  });

  it("keeps normal outbound delivery behavior", async () => {
    const bus = new MessageBus();
    const mockChannel = new MockChannel({}, bus);
    const registration: ExtensionChannelRegistration = {
      extensionId: "mock",
      source: "test",
      channel: {
        id: "discord",
        nextclaw: {
          createChannel: () => mockChannel
        }
      }
    };
    const manager = new ChannelManager({} as Config, bus, undefined, [registration]);

    const delivered = await manager.deliver({
      channel: "discord",
      chatId: "room-1",
      content: "hello",
      media: [],
      metadata: {}
    });

    expect(delivered).toBe(true);
    expect(mockChannel.sent).toHaveLength(1);
    expect(mockChannel.controls).toHaveLength(0);
  });
});
