import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, saveConfig, type ExtensionChannelBinding } from "@nextclaw/core";
import { EventBus } from "@nextclaw/shared";
import { WebSocket } from "ws";
import { startUiServer, type UiServerHandle } from "@nextclaw-server/app/server.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";

const tempDirs: string[] = [];

async function reservePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to resolve test port.")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-server-event-stream-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
}

function createChannelBinding(extensionId: string, channelId: string): ExtensionChannelBinding {
  return {
    extensionId,
    channelId,
    channel: {
      id: channelId,
      meta: {
        label: channelId,
        selectionLabel: channelId,
      },
      outbound: {
        sendText: async () => ({ accepted: true }),
      },
    },
  };
}

async function setupUiAuth(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/auth/setup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: "admin",
      password: "password123",
    }),
  });
  expect(response.status).toBe(201);
}

async function startEventStreamTestServer(params: {
  configPath: string;
  port: number;
  appEventBus: EventBus;
}): Promise<UiServerHandle> {
  const bindings = [
    createChannelBinding("fake-extension", "fake-channel"),
    createChannelBinding("other-extension", "other-channel"),
  ];
  return await startUiServer({
    uiConfig: {
      enabled: true,
      host: "127.0.0.1",
      open: false,
      port: params.port,
    },
    configPath: params.configPath,
    appEventBus: params.appEventBus,
    kernel: createRouterTestKernel(),
    extensions: {
      authenticateEventStreamCredential: (input) =>
        input.extensionId === "fake-extension" &&
        (
          (input.generation === "generation-1" && input.token === "secret") ||
          (input.generation === "generation-2" && input.token === "secret-2")
        )
          ? { extensionId: "fake-extension", generation: input.generation }
          : null,
      getChannelBindings: () => bindings,
      getUiMetadata: () => [],
    },
  });
}

function openSocket(url: string, headers?: Record<string, string>): Promise<WebSocket> {
  const socket = new WebSocket(url, headers ? { headers } : undefined);
  return new Promise((resolve, reject) => {
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
    socket.once("unexpected-response", (_request, response) => {
      reject(new Error(`unexpected response: ${response.statusCode}`));
    });
  });
}

function waitForMessage(socket: WebSocket): Promise<unknown> {
  return new Promise((resolve) => {
    socket.once("message", (data) => resolve(JSON.parse(data.toString()) as unknown));
  });
}

describe("ui server event stream principal auth", () => {
  const handles: UiServerHandle[] = [];
  const sockets: WebSocket[] = [];

  afterEach(async () => {
    while (sockets.length > 0) {
      sockets.pop()?.close();
    }
    while (handles.length > 0) {
      const handle = handles.pop();
      if (handle) {
        await handle.close();
      }
    }
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("keeps ui sockets protected while allowing authenticated extension sockets on the same ws endpoint", async () => {
    const port = await reservePort();
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const appEventBus = new EventBus();
    const handle = await startEventStreamTestServer({ configPath, port, appEventBus });
    handles.push(handle);
    const baseUrl = `http://127.0.0.1:${port}`;
    await setupUiAuth(baseUrl);

    await expect(openSocket(`ws://127.0.0.1:${port}/ws`)).rejects.toThrow("unexpected response: 401");

    const socket = await openSocket(`ws://127.0.0.1:${port}/ws`, {
      authorization: "Bearer secret",
      "x-nextclaw-extension-id": "fake-extension",
      "x-nextclaw-extension-generation": "generation-1",
    });
    sockets.push(socket);

    const messagePromise = waitForMessage(socket);
    appEventBus.emitEnvelope({
      type: "extension.request",
      payload: {
        requestId: "request-1",
        extensionId: "fake-extension",
        generation: "generation-1",
        kind: "channel.auth.start",
      },
      emittedAt: new Date().toISOString(),
      source: "test",
    });

    await expect(messagePromise).resolves.toEqual(expect.objectContaining({
      type: "extension.request",
      payload: expect.objectContaining({
        extensionId: "fake-extension",
      }),
    }));
  });

  it("streams desktop events only to the owning extension generation", async () => {
    const port = await reservePort();
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const appEventBus = new EventBus();
    const handle = await startEventStreamTestServer({ configPath, port, appEventBus });
    handles.push(handle);
    await setupUiAuth(`http://127.0.0.1:${port}`);

    const socket = await openSocket(`ws://127.0.0.1:${port}/ws`, {
      authorization: "Bearer secret",
      "x-nextclaw-extension-id": "fake-extension",
      "x-nextclaw-extension-generation": "generation-1",
    });
    sockets.push(socket);
    const messages: unknown[] = [];
    socket.on("message", (data) => messages.push(JSON.parse(data.toString()) as unknown));

    for (const payload of [
      {
        extensionId: "other-extension",
        generation: "generation-1",
        watchId: "other-extension-watch",
      },
      {
        extensionId: "fake-extension",
        generation: "generation-2",
        watchId: "stale-generation-watch",
      },
      {
        extensionId: "fake-extension",
        generation: "generation-1",
        watchId: "owned-watch",
      },
    ]) {
      appEventBus.emitEnvelope({
        type: "extension.host.desktop.event",
        payload: { ...payload, event: { changed: true } },
        emittedAt: new Date().toISOString(),
        source: "test",
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(messages).toEqual([
      expect.objectContaining({
        type: "extension.host.desktop.event",
        payload: expect.objectContaining({
          extensionId: "fake-extension",
          generation: "generation-1",
          watchId: "owned-watch",
        }),
      }),
    ]);
  });

  it("filters ncp events for extension principals by channel route", async () => {
    const port = await reservePort();
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const appEventBus = new EventBus();
    const handle = await startEventStreamTestServer({ configPath, port, appEventBus });
    handles.push(handle);
    await setupUiAuth(`http://127.0.0.1:${port}`);

    const socket = await openSocket(`ws://127.0.0.1:${port}/ws`, {
      authorization: "Bearer secret",
      "x-nextclaw-extension-id": "fake-extension",
      "x-nextclaw-extension-generation": "generation-1",
    });
    sockets.push(socket);

    const messages: unknown[] = [];
    socket.on("message", (data) => messages.push(JSON.parse(data.toString()) as unknown));
    appEventBus.emitEnvelope({
      type: "ncp.event",
      payload: {
        type: "message.completed",
        payload: {
          message: {
            sessionId: "agent:joker:other-channel:direct:chat-1",
            metadata: {},
          },
        },
      },
      emittedAt: new Date().toISOString(),
      source: "test",
    });
    appEventBus.emitEnvelope({
      type: "ncp.event",
      payload: {
        type: "message.completed",
        payload: {
          message: {
            sessionId: "agent:joker:fake-channel:direct:chat-1",
            metadata: {},
          },
        },
      },
      emittedAt: new Date().toISOString(),
      source: "test",
    });
    appEventBus.emitEnvelope({
      type: "config.updated",
      payload: { path: "extensions" },
      emittedAt: new Date().toISOString(),
      source: "test",
    });
    appEventBus.emitEnvelope({
      type: "config.updated",
      payload: { path: "channels.fake-channel" },
      emittedAt: new Date().toISOString(),
      source: "test",
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual(expect.objectContaining({
      type: "ncp.event",
    }));
    expect(messages[1]).toEqual(expect.objectContaining({
      type: "config.updated",
      payload: { path: "channels.fake-channel" },
    }));
  });

  it("replaces the old extension socket and only streams requests to the target generation", async () => {
    const port = await reservePort();
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const appEventBus = new EventBus();
    const handle = await startEventStreamTestServer({ configPath, port, appEventBus });
    handles.push(handle);
    await setupUiAuth(`http://127.0.0.1:${port}`);

    const first = await openSocket(`ws://127.0.0.1:${port}/ws`, {
      authorization: "Bearer secret",
      "x-nextclaw-extension-id": "fake-extension",
      "x-nextclaw-extension-generation": "generation-1",
    });
    sockets.push(first);
    const firstClosed = new Promise<void>((resolve) => first.once("close", () => resolve()));
    const second = await openSocket(`ws://127.0.0.1:${port}/ws`, {
      authorization: "Bearer secret-2",
      "x-nextclaw-extension-id": "fake-extension",
      "x-nextclaw-extension-generation": "generation-2",
    });
    sockets.push(second);
    await firstClosed;

    const messagePromise = waitForMessage(second);
    appEventBus.emitEnvelope({
      type: "extension.request",
      payload: {
        requestId: "request-new",
        extensionId: "fake-extension",
        generation: "generation-2",
        kind: "channel.auth.start",
      },
      emittedAt: new Date().toISOString(),
      source: "test",
    });
    await expect(messagePromise).resolves.toEqual(expect.objectContaining({
      payload: expect.objectContaining({
        requestId: "request-new",
        generation: "generation-2",
      }),
    }));

    const unexpected: unknown[] = [];
    second.on("message", (data) => unexpected.push(JSON.parse(data.toString()) as unknown));
    appEventBus.emitEnvelope({
      type: "extension.request",
      payload: {
        requestId: "request-stale",
        extensionId: "fake-extension",
        generation: "generation-1",
        kind: "channel.auth.start",
      },
      emittedAt: new Date().toISOString(),
      source: "test",
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(unexpected).toEqual([]);
  });
});
