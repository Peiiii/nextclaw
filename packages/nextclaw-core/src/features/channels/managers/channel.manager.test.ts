import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MessageBus, NEXTCLAW_CONTROL_METADATA_KEY, type OutboundMessage } from "@core/features/bus/index.js";
import type { Config } from "@core/features/config/index.js";
import type { ExtensionRegistry } from "@core/features/extensions/index.js";
import { SessionManager } from "@core/features/session/index.js";
import { BaseChannel } from "@core/features/channels/services/base.js";
import { ChannelManager } from "./channel.manager.js";

class TestChannel extends BaseChannel<Record<string, unknown>> {
  readonly sent: string[] = [];
  controls = 0;

  constructor(private readonly channelName: string, bus: MessageBus) {
    super({}, bus);
  }

  get name(): string {
    return this.channelName;
  }

  readonly start = async (): Promise<void> => {
    this.running = true;
  };

  readonly stop = async (): Promise<void> => {
    this.running = false;
  };

  readonly send = async (message: OutboundMessage): Promise<void> => {
    this.sent.push(message.content);
  };

  override readonly handleControlMessage = async (): Promise<boolean> => {
    this.controls += 1;
    return true;
  };
}

describe("ChannelManager", () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  const createManager = () => {
    tempDir = mkdtempSync(join(tmpdir(), "nextclaw-channel-manager-"));
    const bus = new MessageBus();
    const sessions = new SessionManager({ sessionsDir: tempDir });
    const manager = new ChannelManager({ bus, sessionManager: sessions });
    return { bus, manager };
  };

  const createRegistration = (channel: TestChannel): ExtensionRegistry["channels"][number] => ({
    extensionId: `extension-${channel.name}`,
    source: "test",
    channel: {
      id: channel.name,
      nextclaw: {
        createChannel: () => channel,
      },
    },
  });

  it("loads extension channels and routes outbound/control messages through the same owner", async () => {
    const { bus, manager } = createManager();
    const channel = new TestChannel("test", bus);
    manager.load({
      channelConfig: {} as Config,
      extensionChannels: [createRegistration(channel)],
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
    expect(channel.sent).toEqual(["hello"]);
    expect(channel.controls).toBe(1);

    await manager.stop();
    expect(channel.isRunning).toBe(false);
  });

  it("routes generic extension outbound text handlers", async () => {
    const { manager } = createManager();
    const sent: Array<{ cfg: Config; to: string; text: string; accountId?: string | null }> = [];
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
      media: [],
      metadata: { accountId: "account-1" },
    });

    expect(sent).toEqual([{
      cfg: {},
      to: "chat-1",
      text: "hello",
      accountId: "account-1",
    }]);
    await manager.stop();
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
    const { bus, manager } = createManager();
    const first = new TestChannel("first", bus);
    const second = new TestChannel("second", bus);

    manager.load({
      channelConfig: {} as Config,
      extensionChannels: [createRegistration(first)],
    });
    await manager.start();
    await manager.reload({
      channelConfig: {} as Config,
      extensionChannels: [createRegistration(second)],
      start: true,
    });

    expect(first.isRunning).toBe(false);
    expect(manager.getChannel("first")).toBeNull();
    expect(manager.getChannel("second")).toBe(second);
    expect(second.isRunning).toBe(true);

    await manager.stop();
  });
});
