#!/usr/bin/env node
import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { WebSocketServer, WebSocket } from "ws";
import {
  extractCookie,
  fetchWithRetry,
  findFreePort,
  nextclawCli,
  requestJson,
  rootDir,
  runOrThrow,
  waitFor,
  waitForHealth,
  wranglerBin
} from "./remote-relay-smoke-support.mjs";

const workerDir = resolve(rootDir, "workers/nextclaw-provider-gateway-api");
const workerConfig = resolve(workerDir, "wrangler.toml");

function onceMessage(socket, timeoutMs = 10_000) {
  return new Promise((resolveMessage, rejectMessage) => {
    const timeoutId = setTimeout(() => {
      socket.off("message", handleMessage);
      rejectMessage(new Error("Timed out waiting for websocket message."));
    }, timeoutMs);

    const handleMessage = (data) => {
      clearTimeout(timeoutId);
      socket.off("message", handleMessage);
      resolveMessage(JSON.parse(String(data ?? "")));
    };

    socket.on("message", handleMessage);
  });
}

async function waitForFrame(socket, matcher, timeoutMs = 10_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const frame = await onceMessage(socket, timeoutMs);
    if (matcher(frame)) {
      return frame;
    }
  }
  throw new Error("Timed out waiting for expected websocket frame.");
}

async function main() {
  const persistDir = mkdtempSync(resolve(tmpdir(), "nextclaw-remote-transport-smoke-"));
  const nextclawHome = mkdtempSync(resolve(tmpdir(), "nextclaw-remote-transport-home-"));
  const envFile = resolve(persistDir, ".smoke.env");
  const backendPort = await findFreePort();
  const uiPort = await findFreePort();
  const base = `http://127.0.0.1:${backendPort}`;
  const apiBase = `${base}/v1`;
  const userEmail = `remote-transport.${Date.now()}@example.com`;
  const password = "Passw0rd!";

  let workerProcess = null;
  let connectorProcess = null;
  let workerLogs = "";
  let connectorLogs = "";

  const localUiServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${uiPort}`);
    if (req.method === "GET" && url.pathname === "/api/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, data: { status: "ok" } }));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/auth/bridge") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        ok: true,
        data: {
          cookie: "nextclaw_ui_bridge=smoke-bridge"
        }
      }));
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/config") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        ok: true,
        data: {
          mode: "remote-smoke",
          updatedAt: new Date().toISOString()
        }
      }));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/chat/turn/stream") {
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive"
      });
      res.write('event: ready\n');
      res.write(`data: ${JSON.stringify({ sessionKey: "remote-smoke-session", runId: "run-smoke-1" })}\n\n`);
      res.write('event: delta\n');
      res.write(`data: ${JSON.stringify({ delta: "hello " })}\n\n`);
      res.write('event: session_event\n');
      res.write(`data: ${JSON.stringify({ type: "assistant", content: "hello remote" })}\n\n`);
      res.write('event: final\n');
      res.write(`data: ${JSON.stringify({ sessionKey: "remote-smoke-session", reply: "hello remote" })}\n\n`);
      res.end();
      return;
    }
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<html><body>remote-app-transport-smoke</body></html>");
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: { message: `not found: ${url.pathname}` } }));
  });

  const localUiWss = new WebSocketServer({ noServer: true });
  localUiServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `127.0.0.1:${uiPort}`}`);
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }
    localUiWss.handleUpgrade(request, socket, head, (ws) => {
      localUiWss.emit("connection", ws, request);
    });
  });
  localUiWss.on("connection", (socket) => {
    const sendSessionUpdated = () => {
      socket.send(JSON.stringify({
        type: "session.updated",
        payload: { sessionKey: "remote-smoke-session" }
      }));
    };
    sendSessionUpdated();
    setTimeout(() => {
      if (socket.readyState === WebSocket.OPEN) {
        sendSessionUpdated();
      }
    }, 1_000);
  });

  await new Promise((resolveListen, rejectListen) => {
    localUiServer.once("error", rejectListen);
    localUiServer.listen(uiPort, "127.0.0.1", () => resolveListen());
  });

  writeFileSync(
    envFile,
    [
      "AUTH_TOKEN_SECRET=smoke-token-secret-with-length-at-least-32",
      "DASHSCOPE_API_KEY=smoke-upstream-key",
      "DASHSCOPE_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1",
      "PLATFORM_AUTH_EMAIL_PROVIDER=console",
      "PLATFORM_AUTH_DEV_EXPOSE_CODE=true",
      "GLOBAL_FREE_USD_LIMIT=20",
      "REQUEST_FLAT_USD_PER_REQUEST=0.0002"
    ].join("\n"),
    "utf-8"
  );

  try {
    runOrThrow(wranglerBin, [
      "d1",
      "migrations",
      "apply",
      "NEXTCLAW_PLATFORM_DB",
      "--local",
      "--config",
      workerConfig,
      "--persist-to",
      persistDir
    ]);

    workerProcess = spawn(
      wranglerBin,
      [
        "dev",
        "--local",
        "--port",
        String(backendPort),
        "--config",
        workerConfig,
        "--env-file",
        envFile,
        "--persist-to",
        persistDir
      ],
      {
        cwd: rootDir,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    const captureWorkerLog = (chunk) => {
      workerLogs = `${workerLogs}${String(chunk ?? "")}`.slice(-20_000);
    };
    workerProcess.stdout?.on("data", captureWorkerLog);
    workerProcess.stderr?.on("data", captureWorkerLog);
    await waitForHealth(`${base}/health`);

    runOrThrow("pnpm", ["-C", "packages/nextclaw", "build"]);

    const registerCode = await requestJson({
      method: "POST",
      url: `${base}/platform/auth/register/send-code`,
      body: { email: userEmail },
      expectedStatus: 202
    });
    const debugCode = registerCode.body?.data?.debugCode;
    if (!debugCode) {
      throw new Error(`Missing debug register code: ${JSON.stringify(registerCode.body)}`);
    }
    const registerComplete = await requestJson({
      method: "POST",
      url: `${base}/platform/auth/register/complete`,
      body: {
        email: userEmail,
        code: debugCode,
        password
      },
      expectedStatus: 201
    });
    const userToken = registerComplete.body?.data?.token;
    if (!userToken) {
      throw new Error("Missing user token after registration.");
    }

    runOrThrow("node", [
      nextclawCli,
      "login",
      "--api-base",
      apiBase,
      "--email",
      userEmail,
      "--password",
      password
    ], {
      env: {
        ...process.env,
        NEXTCLAW_HOME: nextclawHome
      }
    });

    connectorProcess = spawn(
      "node",
      [
        nextclawCli,
        "remote",
        "connect",
        "--api-base",
        apiBase,
        "--local-origin",
        `http://127.0.0.1:${uiPort}`,
        "--name",
        "remote-app-transport-smoke",
        "--once"
      ],
      {
        cwd: rootDir,
        env: {
          ...process.env,
          NEXTCLAW_HOME: nextclawHome
        },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    const captureConnectorLog = (chunk) => {
      connectorLogs = `${connectorLogs}${String(chunk ?? "")}`.slice(-20_000);
    };
    connectorProcess.stdout?.on("data", captureConnectorLog);
    connectorProcess.stderr?.on("data", captureConnectorLog);

    const instance = await waitFor(async () => {
      const instancesResponse = await requestJson({
        method: "GET",
        url: `${base}/platform/remote/instances`,
        token: userToken,
        expectedStatus: 200
      });
      const items = instancesResponse.body?.data?.items ?? [];
      return items.find((item) => item.displayName === "remote-app-transport-smoke" && item.status === "online") ?? null;
    }, 30_000, "connector online");

    const openSession = await requestJson({
      method: "POST",
      url: `${base}/platform/remote/instances/${encodeURIComponent(instance.id)}/open`,
      token: userToken,
      body: {},
      expectedStatus: 200
    });
    const openUrl = openSession.body?.data?.openUrl;
    if (!openUrl) {
      throw new Error(`Missing openUrl in session response: ${JSON.stringify(openSession.body)}`);
    }

    const localOpenUrl = new URL(openUrl);
    localOpenUrl.protocol = "http:";
    localOpenUrl.host = `127.0.0.1:${backendPort}`;
    const redirectResponse = await fetchWithRetry(localOpenUrl, { redirect: "manual" }, "owner open redirect");
    if (redirectResponse.status !== 302) {
      throw new Error(`Expected redirect status 302, got ${redirectResponse.status}`);
    }
    const remoteSessionCookie = extractCookie(redirectResponse.headers.get("set-cookie"));

    const runtimeInfo = await requestJson({
      method: "GET",
      url: `${base}/_remote/runtime`,
      expectedStatus: 200,
      headers: { cookie: remoteSessionCookie }
    });
    if (runtimeInfo.body?.data?.wsPath !== "/_remote/ws") {
      throw new Error(`Unexpected remote runtime info: ${JSON.stringify(runtimeInfo.body)}`);
    }

    const remoteSocket = new WebSocket(`ws://127.0.0.1:${backendPort}/_remote/ws`, {
      headers: {
        Cookie: remoteSessionCookie
      }
    });
    await waitFor(
      () => remoteSocket.readyState === WebSocket.OPEN,
      10_000,
      "remote websocket open"
    );

    remoteSocket.send(JSON.stringify({
      type: "request",
      id: "req-1",
      target: {
        method: "GET",
        path: "/api/config"
      }
    }));
    const responseFrame = await waitForFrame(remoteSocket, (frame) => frame?.type === "response" && frame.id === "req-1");
    if (responseFrame.status !== 200 || responseFrame.body?.ok !== true || responseFrame.body?.data?.mode !== "remote-smoke") {
      throw new Error(`Unexpected request response frame: ${JSON.stringify(responseFrame)}`);
    }

    const eventFrame = await waitForFrame(remoteSocket, (frame) => frame?.type === "event");
    if (eventFrame.event?.type !== "session.updated") {
      throw new Error(`Unexpected realtime event frame: ${JSON.stringify(eventFrame)}`);
    }

    remoteSocket.send(JSON.stringify({
      type: "stream.open",
      streamId: "stream-1",
      target: {
        method: "POST",
        path: "/api/chat/turn/stream",
        body: {
          message: "hello"
        }
      }
    }));
    const readyStreamFrame = await waitForFrame(
      remoteSocket,
      (frame) => frame?.type === "stream.event" && frame.streamId === "stream-1" && frame.event === "ready"
    );
    const deltaStreamFrame = await waitForFrame(
      remoteSocket,
      (frame) => frame?.type === "stream.event" && frame.streamId === "stream-1" && frame.event === "delta"
    );
    const finalStreamFrame = await waitForFrame(
      remoteSocket,
      (frame) => frame?.type === "stream.event" && frame.streamId === "stream-1" && frame.event === "final"
    );
    const endStreamFrame = await waitForFrame(
      remoteSocket,
      (frame) => frame?.type === "stream.end" && frame.streamId === "stream-1"
    );

    if (readyStreamFrame.payload?.sessionKey !== "remote-smoke-session") {
      throw new Error(`Unexpected ready stream frame: ${JSON.stringify(readyStreamFrame)}`);
    }
    if (deltaStreamFrame.payload?.delta !== "hello ") {
      throw new Error(`Unexpected delta stream frame: ${JSON.stringify(deltaStreamFrame)}`);
    }
    if (finalStreamFrame.payload?.reply !== "hello remote") {
      throw new Error(`Unexpected final stream frame: ${JSON.stringify(finalStreamFrame)}`);
    }
    if (Object.keys(endStreamFrame).length !== 2) {
      throw new Error(`Unexpected stream end frame: ${JSON.stringify(endStreamFrame)}`);
    }

    remoteSocket.close();
    console.log("[remote-app-transport-smoke] all checks passed.");
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}`
      + `\n[worker logs]\n${workerLogs}`
      + `\n[connector logs]\n${connectorLogs}`
    );
  } finally {
    if (connectorProcess && connectorProcess.exitCode === null && !connectorProcess.killed) {
      connectorProcess.kill("SIGTERM");
      await new Promise((resolveWait) => setTimeout(resolveWait, 800));
      if (connectorProcess.exitCode === null && !connectorProcess.killed) {
        connectorProcess.kill("SIGKILL");
      }
    }
    if (workerProcess && workerProcess.exitCode === null && !workerProcess.killed) {
      workerProcess.kill("SIGTERM");
      await new Promise((resolveWait) => setTimeout(resolveWait, 800));
      if (workerProcess.exitCode === null && !workerProcess.killed) {
        workerProcess.kill("SIGKILL");
      }
    }
    await new Promise((resolveClose) => localUiWss.close(() => resolveClose()));
    await new Promise((resolveClose) => localUiServer.close(() => resolveClose()));
    rmSync(persistDir, { recursive: true, force: true });
    rmSync(nextclawHome, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("[remote-app-transport-smoke] failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
