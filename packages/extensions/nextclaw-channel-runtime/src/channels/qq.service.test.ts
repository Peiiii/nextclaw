import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { Bot } from "qq-official-bot";
import type { MessageBus } from "@nextclaw/core";
import { QQChannel } from "./qq.service.js";

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
        enabled: true,
        appId: "test-app",
        secret: "test-secret",
        allowFrom: [],
        markdownSupport: false
      },
      { publishInbound: mock.fn(async () => {}) } as unknown as MessageBus
    );
  }

  protected override createBot = (): Bot => {
    return this.fakeBot as unknown as Bot;
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
            enabled: true,
            appId: "test-app",
            secret: "test-secret",
            allowFrom: [],
            markdownSupport: false
          },
          { publishInbound: mock.fn(async () => {}) } as unknown as MessageBus
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
});
