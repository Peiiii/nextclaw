import { createServer, type IncomingHttpHeaders } from "node:http";
import { describe, expect, it, vi } from "vitest";
import {
  RemoteConnector,
  type RegisteredRemoteDevice,
  type RemoteRuntimeState,
} from "@nextclaw/remote";

class PanelBridgeSocket {
  readonly readyState = 1;
  readonly sentFrames: string[] = [];
  private readonly listeners = new Map<
    string,
    Array<(event: unknown) => void>
  >();

  addEventListener = (
    type: string,
    listener: (event: unknown) => void,
  ): void => {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  };

  close = (): void => {};

  send = (data: string): void => {
    this.sentFrames.push(data);
  };

  emit = (type: string, event: unknown): void => {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  };
}

function createDevice(): RegisteredRemoteDevice {
  return {
    id: "device-1",
    deviceInstallId: "device-install-id",
    displayName: "dev-machine",
    platform: "nextclaw",
    appVersion: "0.25.3",
    localOrigin: "http://127.0.0.1",
    status: "online",
    lastSeenAt: "2026-07-18T00:00:00.000Z",
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
  };
}

function findResponseStatus(
  socket: PanelBridgeSocket,
  requestId: string,
): number | undefined {
  return socket.sentFrames
    .map(
      (frame) =>
        JSON.parse(frame) as { type?: string; id?: string; status?: number },
    )
    .find((frame) => frame.type === "client.response" && frame.id === requestId)
    ?.status;
}

describe("remote panel app bridge", () => {
  it("forwards bridge headers while replacing untrusted proxy headers", async () => {
    const actionRequests: IncomingHttpHeaders[] = [];
    const server = createServer((request, response) => {
      response.setHeader("content-type", "application/json");
      if (request.url === "/api/auth/bridge") {
        response.end(
          JSON.stringify({
            ok: true,
            data: { cookie: "nextclaw_ui_session=trusted" },
          }),
        );
        return;
      }
      if (
        request.url === "/api/service-actions/music-player.listSongs/invoke"
      ) {
        actionRequests.push({ ...request.headers });
        const authorized =
          request.headers["x-nextclaw-panel-bridge-session"] ===
          "runtime-token";
        response.statusCode = authorized ? 200 : 401;
        response.end(
          JSON.stringify(
            authorized
              ? { ok: true, data: { result: { songs: [] } } }
              : {
                  ok: false,
                  error: { code: "PANEL_APP_BRIDGE_SESSION_REQUIRED" },
                },
          ),
        );
        return;
      }
      response.statusCode = 404;
      response.end(JSON.stringify({ ok: false }));
    });
    server.on("upgrade", (_request, socket) => socket.destroy());
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      server.once("error", onError);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", onError);
        resolve();
      });
    });

    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected the test server to listen on a TCP port.");
      }
      const localOrigin = `http://127.0.0.1:${address.port}`;
      const statusWrites: Array<
        Omit<RemoteRuntimeState, "mode" | "updatedAt">
      > = [];
      const socket = new PanelBridgeSocket();
      const connector = new RemoteConnector({
        platformClient: {
          resolveRunContext: vi.fn().mockReturnValue({
            config: { remote: { enabled: true, autoReconnect: false } },
            platformBase: "https://ai-gateway-api.nextclaw.io",
            token: "nca.valid.sig",
            localOrigin,
            displayName: "dev-machine",
            deviceInstallId: "device-install-id",
            autoReconnect: false,
          }),
          registerDevice: vi
            .fn<() => Promise<RegisteredRemoteDevice>>()
            .mockResolvedValue(createDevice()),
        } as never,
        relayBridgeFactory: () =>
          ({
            ensureLocalUiHealthy: vi.fn().mockResolvedValue(undefined),
          }) as never,
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        createSocket: () => {
          queueMicrotask(() => socket.emit("open", {}));
          return socket as unknown as WebSocket;
        },
      });
      const runTask = connector.run({
        mode: "service",
        autoReconnect: false,
        statusStore: {
          write: (next) => statusWrites.push(next),
        },
      });
      await vi.waitFor(() =>
        expect(statusWrites.some((entry) => entry.state === "connected")).toBe(
          true,
        ),
      );

      socket.emit("message", {
        data: JSON.stringify({
          type: "client.request",
          clientId: "panel-client",
          id: "missing-session",
          target: {
            method: "POST",
            path: "/api/service-actions/music-player.listSongs/invoke",
            body: { input: {} },
          },
        }),
      });
      await vi.waitFor(() =>
        expect(findResponseStatus(socket, "missing-session")).toBe(401),
      );

      socket.emit("message", {
        data: JSON.stringify({
          type: "client.request",
          clientId: "panel-client",
          id: "list-songs",
          target: {
            method: "POST",
            path: "/api/service-actions/music-player.listSongs/invoke",
            headers: {
              "content-type": "text/plain",
              "x-nextclaw-panel-bridge-session": "runtime-token",
              "x-panel-request": "forwarded",
              cookie: "attacker=1",
              host: "attacker.invalid",
              "content-length": "999",
              "x-forwarded-for": "203.0.113.1",
            },
            body: { input: {} },
          },
        }),
      });
      await vi.waitFor(() =>
        expect(findResponseStatus(socket, "list-songs")).toBe(200),
      );

      const actionHeaders = actionRequests.at(-1);
      expect(actionHeaders).toMatchObject({
        "content-type": "application/json",
        "x-nextclaw-panel-bridge-session": "runtime-token",
        "x-panel-request": "forwarded",
        cookie: "nextclaw_ui_session=trusted",
      });
      expect(actionHeaders?.host).not.toBe("attacker.invalid");
      expect(actionHeaders?.["content-length"]).not.toBe("999");
      expect(actionHeaders?.["x-forwarded-for"]).toBeUndefined();

      socket.emit("close", { code: 1000, reason: "", wasClean: true });
      await runTask;
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
