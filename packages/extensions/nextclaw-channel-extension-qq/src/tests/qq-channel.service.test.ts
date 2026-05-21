import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { Bot } from "qq-official-bot";
import type { PrivateMessageEvent } from "qq-official-bot";
import { QQChannel, type QQChannelBus } from "../services/qq-channel.service.js";

type FakeBot = {
  start: ReturnType<typeof mock.fn>;
  stop: ReturnType<typeof mock.fn>;
  removeAllListeners: ReturnType<typeof mock.fn>;
  sessionManager: {
    removeAllListeners: ReturnType<typeof mock.fn>;
  };
};

class TestQQChannel extends QQChannel {
  protected override readonly connectTimeoutMs = 10;

  constructor(private readonly fakeBot: FakeBot) {
    super(
      {
        appId: "test-app",
        secret: "test-secret",
        allowFrom: []
      },
      { publishInbound: mock.fn(async () => {}) } as QQChannelBus
    );
  }

  protected override createBot = (): Bot => {
    return this.fakeBot as unknown as Bot;
  };
}

class InboundTestQQChannel extends QQChannel {
  constructor(private readonly publishInbound: QQChannelBus["publishInbound"]) {
    super(
      {
        appId: "test-app",
        secret: "test-secret",
        allowFrom: []
      },
      { publishInbound }
    );
  }

  handleTestIncoming = async (event: Partial<PrivateMessageEvent>): Promise<void> => {
    await (this as unknown as {
      handleIncoming: (event: PrivateMessageEvent) => Promise<void>;
    }).handleIncoming(event as PrivateMessageEvent);
  };
}

function createFakeBot(start: () => Promise<void>): FakeBot {
  return {
    start: mock.fn(start),
    stop: mock.fn(async () => {}),
    removeAllListeners: mock.fn(),
    sessionManager: {
      removeAllListeners: mock.fn()
    }
  };
}

describe("QQChannel startup lifecycle", () => {
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;

  afterEach(() => {
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    mock.reset();
  });

  it("does not report running when the QQ SDK never becomes ready", async () => {
    const errorLogs: unknown[][] = [];
    console.error = (...args: unknown[]) => {
      errorLogs.push(args);
    };
    const fakeBot = createFakeBot(() => new Promise(() => {}));
    const channel = new TestQQChannel(fakeBot);

    await channel.start();

    assert.equal(channel.isRunning, false);
    assert.equal(fakeBot.stop.mock.callCount(), 1);
    assert.match(String(errorLogs[0]?.[0] ?? ""), /\[qq\] start failed \(startup, attempt 1\)/);

    await channel.stop();
  });

  it("reports running only after the QQ SDK start resolves", async () => {
    const logs: unknown[][] = [];
    console.log = (...args: unknown[]) => {
      logs.push(args);
    };
    const fakeBot = createFakeBot(async () => {});
    const channel = new TestQQChannel(fakeBot);

    await channel.start();

    assert.equal(channel.isRunning, true);
    assert.deepEqual(logs[0], ["QQ bot connected"]);

    await channel.stop();
    assert.equal(fakeBot.stop.mock.callCount(), 1);
    assert.equal(channel.isRunning, false);
  });

  it("keeps waiting for slow QQ SDK startup before reporting failure", async () => {
    const fakeBot = createFakeBot(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    class SlowQQChannel extends QQChannel {
      protected override readonly connectTimeoutMs = 50;

      constructor(private readonly slowFakeBot: FakeBot) {
        super(
          {
            appId: "test-app",
            secret: "test-secret",
            allowFrom: []
          },
          { publishInbound: mock.fn(async () => {}) } as QQChannelBus
        );
      }

      protected override createBot = (): Bot => {
        return this.slowFakeBot as unknown as Bot;
      };
    }
    const channel = new SlowQQChannel(fakeBot);

    await channel.start();

    assert.equal(channel.isRunning, true);
    await channel.stop();
  });

  it("accepts official bot private events that only expose sender openid", async () => {
    const publishInbound = mock.fn(async () => {});
    const channel = new InboundTestQQChannel(publishInbound as QQChannelBus["publishInbound"]);

    await channel.handleTestIncoming({
      id: "message-1",
      message_id: "message-1",
      raw_message: "你好啊",
      sender: {
        user_openid: "user-openid-1",
        user_name: "Pei"
      },
      author: {
        user_openid: "user-openid-1",
        username: "Pei"
      }
    } as unknown as Partial<PrivateMessageEvent>);

    assert.equal(publishInbound.mock.callCount(), 1);
    const inbound = (publishInbound.mock.calls as unknown as Array<{
      arguments: [Record<string, unknown>];
    }>)[0]?.arguments[0];
    assert.deepEqual(inbound, {
      channel: "qq",
      senderId: "user-openid-1",
      chatId: "user-openid-1",
      content: "[speaker:user_id=user-openid-1;name=Pei] 你好啊",
      metadata: {
        message_id: "message-1",
        qq: {
          userId: "user-openid-1",
          userName: "Pei",
          messageType: "private"
        }
      }
    });
  });

  it("drops messages from the bot itself only when both ids are present and equal", async () => {
    const publishInbound = mock.fn(async () => {});
    const channel = new InboundTestQQChannel(publishInbound as QQChannelBus["publishInbound"]);

    await channel.handleTestIncoming({
      id: "message-1",
      message_id: "message-1",
      raw_message: "self",
      user_id: "bot-id",
      self_id: "bot-id"
    } as unknown as Partial<PrivateMessageEvent>);

    assert.equal(publishInbound.mock.callCount(), 0);
  });
});
