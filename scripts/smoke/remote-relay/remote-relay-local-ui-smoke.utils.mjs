import { createServer } from "node:http";
import { WebSocketServer } from "ws";

function listen(server, port) {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, "127.0.0.1", () => resolveListen());
  });
}

function closeServer(server) {
  return new Promise((resolveClose) => server.close(() => resolveClose()));
}

function respondJson(response, status, data) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(data));
}

export async function startPrimaryRemoteUiFixture(port) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    if (request.method === "GET" && url.pathname === "/api/health") {
      respondJson(response, 200, { ok: true });
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/auth/bridge") {
      respondJson(response, 200, {
        ok: true,
        data: { cookie: "nextclaw_ui_bridge=smoke-bridge" },
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/probe") {
      respondJson(response, 200, {
        ok: true,
        path: url.pathname,
        search: url.search,
        cookie: request.headers.cookie ?? "",
        forwardedHost: request.headers["x-forwarded-host"] ?? "",
      });
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/panel-app-client-sdk.js"
    ) {
      response.writeHead(200, {
        "content-type": "application/javascript; charset=utf-8",
      });
      response.end("globalThis.__remotePanelSmoke = true;");
      return;
    }
    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<html><body>remote-smoke-ok</body></html>");
      return;
    }
    respondJson(response, 404, { error: "not_found", path: url.pathname });
  });
  const webSocketServer = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? `127.0.0.1:${port}`}`,
    );
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }
    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      webSocketServer.emit("connection", webSocket, request);
    });
  });
  webSocketServer.on("connection", (socket) => {
    socket.send(
      JSON.stringify({
        type: "session.updated",
        payload: { sessionKey: "remote-hibernation-smoke-session" },
      }),
    );
  });
  await listen(server, port);
  return {
    close: async () => {
      webSocketServer.close();
      await closeServer(server);
    },
  };
}

export async function startSecondaryRemoteUiFixture(port) {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    if (request.method === "GET" && url.pathname === "/api/health") {
      respondJson(response, 200, { ok: true });
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/auth/bridge") {
      respondJson(response, 200, {
        ok: true,
        data: { cookie: "nextclaw_ui_bridge=secondary-smoke" },
      });
      return;
    }
    respondJson(response, 404, { error: "not_found" });
  });
  await listen(server, port);
  return { close: async () => await closeServer(server) };
}
