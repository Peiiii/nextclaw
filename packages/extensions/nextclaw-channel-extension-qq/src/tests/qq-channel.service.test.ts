import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  DIAGNOSTIC_CORRELATION_METADATA_KEY,
  type BusChannelMessageBus,
  type ExtensionDiagnostics,
} from "@nextclaw/extension-sdk";
import type { Bot, PrivateMessageEvent, ReceiverMode } from "qq-official-bot";
import {
  QQGatewaySessionLimitError,
  QQGatewayStartupProbeService
} from "../services/qq-gateway-startup-probe.service.js";
import { QQChannel } from "../services/qq-channel.service.js";

type FakeBot = {
  start: ReturnType<typeof mock.fn>;
  stop: ReturnType<typeof mock.fn>;
  removeAllListeners: ReturnType<typeof mock.fn>;
  receiver: EventEmitter;
  sessionManager: EventEmitter & {
    removeAllListeners: ReturnType<typeof mock.fn>;
  };
};

class TestQQChannel extends QQChannel {
  protected override readonly connectTimeoutMs: number;

  constructor(
    private readonly fakeBot: FakeBot,
    connectTimeoutMs = 10,
    diagnostics?: ExtensionDiagnostics,
  ) {
    super(
      {
        appId: "test-app",
        secret: "test-secret",
        allowFrom: []
      },
      { publishInbound: mock.fn(async () => {}) } as BusChannelMessageBus,
      diagnostics,
    );
    this.connectTimeoutMs = connectTimeoutMs;
  }

  protected override createBot = (): Bot<ReceiverMode.WEBSOCKET> => {
    return this.fakeBot as unknown as Bot<ReceiverMode.WEBSOCKET>;
  };

  protected override verifyGatewaySessionAvailability = async (): Promise<void> => {};
}

class InboundTestQQChannel extends QQChannel {
  constructor(
    private readonly publishInbound: BusChannelMessageBus["publishInbound"],
    diagnostics?: ExtensionDiagnostics,
  ) {
    super(
      {
        appId: "test-app",
        secret: "test-secret",
        allowFrom: []
      },
      { publishInbound },
      diagnostics,
    );
  }

  handleTestIncoming = async (event: Partial<PrivateMessageEvent>): Promise<void> => {
    await (this as unknown as {
      handleIncoming: (event: PrivateMessageEvent) => Promise<void>;
    }).handleIncoming(event as PrivateMessageEvent);
  };
}

function createFakeBot(start: () => Promise<void>): FakeBot {
  const sessionManager = new EventEmitter() as FakeBot["sessionManager"];
  sessionManager.removeAllListeners = mock.fn(sessionManager.removeAllListeners.bind(sessionManager)) as never;
  return {
    start: mock.fn(start),
    stop: mock.fn(async () => {}),
    removeAllListeners: mock.fn(),
    receiver: new EventEmitter(),
    sessionManager
  };
}

function createFetchResponse(payload: Record<string, unknown>, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

function createGatewayProbeFetch(sessionLimit: Record<string, unknown>): typeof fetch {
  const fetchMock = mock.fn(async (url: string | URL | Request) => {
    const target = String(url);
    if (target.includes("getAppAccessToken")) {
      return createFetchResponse({ access_token: "token" });
    }
    return createFetchResponse({
      url: "wss://gateway.example",
      session_start_limit: sessionLimit,
    });
  });
  return fetchMock as unknown as typeof fetch;
}

describe("QQGatewayStartupProbeService", () => {
  it("allows startup when QQ gateway session quota remains", async () => {
    const probe = new QQGatewayStartupProbeService({
      appId: "test-app",
      secret: "test-secret",
      fetchImpl: createGatewayProbeFetch({ remaining: 1 }),
    });

    await probe.verifySessionAvailable();
  });

  it("blocks startup when QQ gateway session quota is exhausted", async () => {
    const probe = new QQGatewayStartupProbeService({
      appId: "test-app",
      secret: "test-secret",
      fetchImpl: createGatewayProbeFetch({
        remaining: 0,
        reset_after: 60000,
        total: 1500,
        max_concurrency: 1,
      }),
    });

    await assert.rejects(
      probe.verifySessionAvailable(),
      /session start limit exhausted; reset_after_ms=60000, total=1500, max_concurrency=1/
    );
  });
});

describe("QQChannel startup lifecycle", () => {
  afterEach(() => {
    mock.reset();
  });

  it("does not report running when the QQ SDK never becomes ready", async () => {
    const fakeBot = createFakeBot(() => new Promise(() => {}));
    const channel = new TestQQChannel(fakeBot);

    await channel.start();

    assert.equal(channel.isRunning, false);
    assert.equal(fakeBot.stop.mock.callCount(), 1);

    await channel.stop();
  });

  it("reports gateway session close errors without waiting for the full startup timeout", async () => {
    const fakeBot = createFakeBot(() => new Promise(() => {}));
    const channel = new TestQQChannel(fakeBot, 500);

    const startPromise = channel.start();
    await new Promise((resolve) => setImmediate(resolve));
    fakeBot.receiver.emit("close", 4903, Buffer.from("create session error"));
    await startPromise;

    assert.equal(channel.isRunning, false);
    assert.equal(fakeBot.stop.mock.callCount(), 1);

    await channel.stop();
  });

  it("does not create a websocket bot when QQ gateway quota is exhausted", async () => {
    const emit = mock.fn(async (_event: Parameters<ExtensionDiagnostics["emit"]>[0]) => true);
    const fakeBot = createFakeBot(async () => {});
    class QuotaBlockedQQChannel extends TestQQChannel {
      protected override verifyGatewaySessionAvailability = async (): Promise<void> => {
        throw new QQGatewaySessionLimitError(60000, 1500, 1);
      };
    }
    const channel = new QuotaBlockedQQChannel(fakeBot, 10, {
      createTraceId: () => "unused",
      emit,
    });

    await channel.start();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(fakeBot.start.mock.callCount(), 0);
    assert.equal(channel.isRunning, false);
    const failure = emit.mock.calls
      .map((call) => call.arguments[0])
      .find((event) => event.event === "gateway.connect.failed");
    assert.equal(failure?.reasonCode, "session_limit");
    assert.equal(failure?.facts?.reconnectInMs, 60000);

    await channel.stop();
  });

  it("reports running only after the QQ SDK start resolves", async () => {
    const fakeBot = createFakeBot(async () => {});
    const channel = new TestQQChannel(fakeBot);

    await channel.start();

    assert.equal(channel.isRunning, true);

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
          { publishInbound: mock.fn(async () => {}) } as BusChannelMessageBus
        );
      }

      protected override createBot = (): Bot<ReceiverMode.WEBSOCKET> => {
        return this.slowFakeBot as unknown as Bot<ReceiverMode.WEBSOCKET>;
      };

      protected override verifyGatewaySessionAvailability = async (): Promise<void> => {};
    }
    const channel = new SlowQQChannel(fakeBot);

    await channel.start();

    assert.equal(channel.isRunning, true);
    await channel.stop();
  });
});

describe("QQChannel message delivery diagnostics", () => {
  afterEach(() => {
    mock.reset();
  });

  it("accepts official bot private events that only expose sender openid", async () => {
    const publishInbound = mock.fn(async () => {});
    const channel = new InboundTestQQChannel(publishInbound as BusChannelMessageBus["publishInbound"]);

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

  it("emits privacy-safe delivery diagnostics with one correlation id", async () => {
    const publishInbound = mock.fn(async (
      _message: Parameters<BusChannelMessageBus["publishInbound"]>[0],
    ) => {});
    const emit = mock.fn(async (_event: Parameters<ExtensionDiagnostics["emit"]>[0]) => true);
    const channel = new InboundTestQQChannel(
      publishInbound as BusChannelMessageBus["publishInbound"],
      {
        createTraceId: () => "trace-qq-1",
        emit,
      },
    );

    await channel.handleTestIncoming({
      id: "provider-message-1",
      message_id: "provider-message-1",
      raw_message: "private message body",
      sender: { user_openid: "user-openid-1" },
    } as unknown as Partial<PrivateMessageEvent>);
    await new Promise((resolve) => setImmediate(resolve));

    const events = emit.mock.calls.map((call) => call.arguments[0]);
    assert.deepEqual(events.map((event) => event.event), [
      "inbound.observed",
      "inbound.submit.started",
      "inbound.submit.succeeded",
    ]);
    assert.ok(events.every((event) => event.correlationId === "trace-qq-1"));
    assert.ok(events.every((event) => JSON.stringify(event).includes("private message body") === false));
    assert.ok(events.every((event) => JSON.stringify(event).includes("user-openid-1") === false));
    const inbound = publishInbound.mock.calls[0]?.arguments[0];
    assert.equal(
      inbound?.metadata?.[DIAGNOSTIC_CORRELATION_METADATA_KEY],
      "trace-qq-1",
    );
  });

  it("does not block inbound delivery when diagnostic transport stalls", async () => {
    const publishInbound = mock.fn(async () => {});
    const channel = new InboundTestQQChannel(
      publishInbound as BusChannelMessageBus["publishInbound"],
      {
        createTraceId: () => "trace-stalled-diagnostics",
        emit: async () => await new Promise<boolean>(() => {}),
      },
    );

    await Promise.race([
      channel.handleTestIncoming({
        id: "message-with-stalled-diagnostics",
        raw_message: "still deliver",
        sender: { user_openid: "user-openid-1" },
      } as unknown as Partial<PrivateMessageEvent>),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error("diagnostics blocked inbound delivery")), 200);
      }),
    ]);

    assert.equal(publishInbound.mock.callCount(), 1);
  });

  it("drops messages from the bot itself only when both ids are present and equal", async () => {
    const publishInbound = mock.fn(async () => {});
    const channel = new InboundTestQQChannel(publishInbound as BusChannelMessageBus["publishInbound"]);

    await channel.handleTestIncoming({
      id: "message-1",
      message_id: "message-1",
      raw_message: "self",
      user_id: "bot-id",
      self_id: "bot-id"
    } as unknown as Partial<PrivateMessageEvent>);

    assert.equal(publishInbound.mock.callCount(), 0);
  });

  it("allows the same message id to retry after inbound publication fails", async () => {
    let attempts = 0;
    const publishInbound = mock.fn(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("injected ingress failure");
      }
    });
    const channel = new InboundTestQQChannel(publishInbound as BusChannelMessageBus["publishInbound"]);
    const event = {
      id: "message-retry",
      message_id: "message-retry",
      raw_message: "retry me",
      sender: { user_openid: "user-openid-1" }
    } as unknown as Partial<PrivateMessageEvent>;
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
      await assert.rejects(channel.handleTestIncoming(event), /injected ingress failure/);
      await channel.handleTestIncoming(event);
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(publishInbound.mock.callCount(), 2);
  });

  it("suppresses concurrent and completed deliveries with the same message id", async () => {
    let releasePublish!: () => void;
    const publishGate = new Promise<void>((resolve) => {
      releasePublish = resolve;
    });
    const publishInbound = mock.fn(async () => {
      await publishGate;
    });
    const channel = new InboundTestQQChannel(publishInbound as BusChannelMessageBus["publishInbound"]);
    const event = {
      id: "message-duplicate",
      message_id: "message-duplicate",
      raw_message: "only once",
      sender: { user_openid: "user-openid-1" }
    } as unknown as Partial<PrivateMessageEvent>;

    const first = channel.handleTestIncoming(event);
    await new Promise((resolve) => setImmediate(resolve));
    await channel.handleTestIncoming(event);
    assert.equal(publishInbound.mock.callCount(), 1);

    releasePublish();
    await first;
    await channel.handleTestIncoming(event);

    assert.equal(publishInbound.mock.callCount(), 1);
  });

  it("fails explicitly when outbound delivery is attempted while disconnected", async () => {
    const emit = mock.fn(async (_event: Parameters<ExtensionDiagnostics["emit"]>[0]) => true);
    const channel = new QQChannel(
      { appId: "test-app", secret: "test-secret", allowFrom: [] },
      { publishInbound: mock.fn(async () => {}) } as BusChannelMessageBus,
      { createTraceId: () => "unused", emit },
    );

    await assert.rejects(
      channel.send({
        channel: "qq",
        chatId: "user-openid-1",
        content: "reply",
        media: [],
        metadata: {}
      }),
      /QQ channel is not connected/
    );
    await new Promise((resolve) => setImmediate(resolve));
    const failure = emit.mock.calls
      .map((call) => call.arguments[0])
      .find((event) => event.event === "provider.send.failed");
    assert.equal(failure?.reasonCode, "channel_not_connected");
  });
});
