#!/usr/bin/env node
import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { WebSocketServer } from "ws";
import {
  assertFixedDomainOpenUrlShape,
  assertRemoteOpenUrlShape,
  extractCookie,
  fetchWithRetry,
  findFreePort,
  nextclawCli,
  queryLocalD1,
  requestJson,
  rootDir,
  runOrThrow,
  waitFor,
  waitForHealth,
  wranglerBin,
} from "./remote-relay-smoke-support.mjs";

const workerDir = resolve(rootDir, "workers/nextclaw-provider-gateway-api");
const workerConfig = resolve(
  workerDir,
  "wrangler.toml"
);

async function main() {
  const persistDir = mkdtempSync(resolve(tmpdir(), "nextclaw-remote-relay-smoke-"));
  const nextclawHome = mkdtempSync(resolve(tmpdir(), "nextclaw-remote-home-"));
  const envFile = resolve(persistDir, ".smoke.env");
  const backendPort = await findFreePort();
  const uiPort = await findFreePort();
  const base = `http://127.0.0.1:${backendPort}`;
  const apiBase = `${base}/v1`;
  const userEmail = `remote-smoke.${Date.now()}@example.com`;
  const password = "Passw0rd!";

  let workerProcess = null;
  let connectorProcess = null;
  let workerLogs = "";
  let connectorLogs = "";

  const localUiServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${uiPort}`);
    if (req.method === "GET" && url.pathname === "/api/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
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
    if (req.method === "GET" && url.pathname === "/probe") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        ok: true,
        path: url.pathname,
        search: url.search,
        cookie: req.headers.cookie ?? ""
      }));
      return;
    }
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<html><body>remote-smoke-ok</body></html>");
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found", path: url.pathname }));
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
    socket.send(JSON.stringify({
      type: "session.updated",
      payload: { sessionKey: "remote-hibernation-smoke-session" }
    }));
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
    console.log("[remote-relay-smoke] apply local migrations...");
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

    console.log("[remote-relay-smoke] start worker...");
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

    console.log("[remote-relay-smoke] build affected CLI...");
    runOrThrow("pnpm", ["-C", "packages/nextclaw", "build"]);

    console.log("[remote-relay-smoke] register smoke user via platform auth API...");
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

    console.log("[remote-relay-smoke] login via nextclaw CLI...");
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

    console.log("[remote-relay-smoke] start real connector...");
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
        "remote-hibernation-smoke",
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
      return items.find((item) => item.displayName === "remote-hibernation-smoke" && item.status === "online") ?? null;
    }, 30_000, "connector online");

    console.log("[remote-relay-smoke] verify no heartbeat writes after idle...");
    const [deviceRowBeforeIdle] = queryLocalD1({
      persistDir,
      sql: `SELECT status, last_seen_at, updated_at FROM remote_devices WHERE id = '${instance.id}'`
    });
    if (!deviceRowBeforeIdle || deviceRowBeforeIdle.status !== "online") {
      throw new Error(`Expected online remote device row, got ${JSON.stringify(deviceRowBeforeIdle)}`);
    }
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 18_000));
    const [deviceRowAfterIdle] = queryLocalD1({
      persistDir,
      sql: `SELECT status, last_seen_at, updated_at FROM remote_devices WHERE id = '${instance.id}'`
    });
    if (!deviceRowAfterIdle || deviceRowAfterIdle.status !== "online") {
      throw new Error(`Expected online remote device row after idle, got ${JSON.stringify(deviceRowAfterIdle)}`);
    }
    if (
      deviceRowAfterIdle.last_seen_at !== deviceRowBeforeIdle.last_seen_at
      || deviceRowAfterIdle.updated_at !== deviceRowBeforeIdle.updated_at
    ) {
      throw new Error(
        `Expected no heartbeat-driven DB writes while idle, before=${JSON.stringify(deviceRowBeforeIdle)}, after=${JSON.stringify(deviceRowAfterIdle)}`
      );
    }

    console.log("[remote-relay-smoke] open remote session and verify local bridge...");
    const openSession = await requestJson({
      method: "POST",
      url: `${base}/platform/remote/instances/${encodeURIComponent(instance.id)}/open`,
      token: userToken,
      body: {},
      expectedStatus: 200
    });
    const openUrl = openSession.body?.data?.openUrl;
    const fixedDomainOpenUrl = openSession.body?.data?.fixedDomainOpenUrl;
    const sessionCreatedAt = openSession.body?.data?.lastUsedAt;
    if (!openUrl) {
      throw new Error(`Missing openUrl in session response: ${JSON.stringify(openSession.body)}`);
    }
    const remoteOpenUrl = assertRemoteOpenUrlShape(openUrl, "owner openUrl");
    if (!fixedDomainOpenUrl) {
      throw new Error(`Missing fixedDomainOpenUrl in session response: ${JSON.stringify(openSession.body)}`);
    }
    assertFixedDomainOpenUrlShape(fixedDomainOpenUrl, "owner fixedDomainOpenUrl");
    if (!sessionCreatedAt) {
      throw new Error(`Missing lastUsedAt in session response: ${JSON.stringify(openSession.body)}`);
    }
    const [sessionRowBeforeProxies] = queryLocalD1({
      persistDir,
      sql: "SELECT id, last_used_at, updated_at FROM remote_sessions ORDER BY created_at DESC LIMIT 1"
    });
    if (!sessionRowBeforeProxies) {
      throw new Error("Missing remote session row before proxied requests.");
    }
    const localOpenUrl = new URL(remoteOpenUrl);
    localOpenUrl.protocol = "http:";
    localOpenUrl.host = `127.0.0.1:${backendPort}`;
    const redirectResponse = await fetchWithRetry(localOpenUrl, { redirect: "manual" }, "owner open redirect");
    if (redirectResponse.status !== 302) {
      throw new Error(
        `Expected redirect status 302, got ${redirectResponse.status}, openUrl=${openUrl}, localOpenUrl=${localOpenUrl}, body=${await redirectResponse.text()}`
      );
    }
    const remoteSessionCookie = extractCookie(redirectResponse.headers.get("set-cookie"));
    const proxiedProbe = await requestJson({
      method: "GET",
      url: `${base}/probe?hit=1`,
      expectedStatus: 200,
      headers: { cookie: remoteSessionCookie }
    });
    if (!String(proxiedProbe.body?.cookie ?? "").includes("nextclaw_ui_bridge=smoke-bridge")) {
      throw new Error(`Expected bridged local auth cookie, got ${JSON.stringify(proxiedProbe.body)}`);
    }

    const secondProxy = await requestJson({
      method: "GET",
      url: `${base}/probe?hit=2`,
      expectedStatus: 200,
      headers: { cookie: remoteSessionCookie }
    });
    if (!secondProxy.body?.ok) {
      throw new Error(`Second proxied request failed: ${JSON.stringify(secondProxy.body)}`);
    }
    const [sessionRowAfterProxies] = queryLocalD1({
      persistDir,
      sql: "SELECT id, last_used_at, updated_at FROM remote_sessions ORDER BY created_at DESC LIMIT 1"
    });
    if (!sessionRowAfterProxies) {
      throw new Error("Missing remote session row after proxied requests.");
    }
    if (
      sessionRowAfterProxies.last_used_at !== sessionRowBeforeProxies.last_used_at
      || sessionRowAfterProxies.updated_at !== sessionRowBeforeProxies.updated_at
    ) {
      throw new Error(
        `Expected throttled session touch, before=${JSON.stringify(sessionRowBeforeProxies)}, after=${JSON.stringify(sessionRowAfterProxies)}, sessionCreatedAt=${sessionCreatedAt}`
      );
    }

    console.log("[remote-relay-smoke] create share link and verify revocation closes existing shared session...");
    const createdShare = await requestJson({
      method: "POST",
      url: `${base}/platform/remote/instances/${encodeURIComponent(instance.id)}/shares`,
      token: userToken,
      body: {},
      expectedStatus: 200
    });
    const shareUrl = createdShare.body?.data?.shareUrl;
    const grantId = createdShare.body?.data?.id;
    if (!shareUrl || !grantId) {
      throw new Error(`Missing share grant payload: ${JSON.stringify(createdShare.body)}`);
    }
    const parsedShareUrl = new URL(shareUrl);
    if (parsedShareUrl.origin !== "https://platform.nextclaw.io" || !parsedShareUrl.pathname.startsWith("/share/")) {
      throw new Error(`Share URL must stay on platform.nextclaw.io/share/<token>, got ${shareUrl}`);
    }
    const sharePath = parsedShareUrl.pathname;
    const grantToken = sharePath.split("/").filter(Boolean).at(-1);
    if (!grantToken) {
      throw new Error(`Missing grant token in share URL: ${shareUrl}`);
    }
    const shareOpenApiResponse = await requestJson({
      method: "POST",
      url: `${base}/platform/share/${encodeURIComponent(grantToken)}/open`,
      expectedStatus: 200
    });
    const sharedOpenUrl = shareOpenApiResponse.body?.data?.openUrl;
    const sharedFixedDomainOpenUrl = shareOpenApiResponse.body?.data?.fixedDomainOpenUrl;
    if (!sharedOpenUrl) {
      throw new Error(`Missing openUrl in share open response: ${JSON.stringify(shareOpenApiResponse.body)}`);
    }
    const parsedSharedOpenUrl = assertRemoteOpenUrlShape(sharedOpenUrl, "share openUrl");
    if (!sharedFixedDomainOpenUrl) {
      throw new Error(`Missing fixedDomainOpenUrl in share open response: ${JSON.stringify(shareOpenApiResponse.body)}`);
    }
    assertFixedDomainOpenUrlShape(sharedFixedDomainOpenUrl, "share fixedDomainOpenUrl");
    if (parsedSharedOpenUrl.hostname === remoteOpenUrl.hostname) {
      throw new Error(
        `Share openUrl must allocate a distinct access-session host, owner=${openUrl}, share=${sharedOpenUrl}`
      );
    }
    const localSharedOpenUrl = new URL(parsedSharedOpenUrl);
    localSharedOpenUrl.protocol = "http:";
    localSharedOpenUrl.host = `127.0.0.1:${backendPort}`;
    const shareOpenResponse = await fetchWithRetry(localSharedOpenUrl, { redirect: "manual" }, "share open redirect");
    if (shareOpenResponse.status !== 302) {
      throw new Error(
        `Expected open redirect status 302 from share, got ${shareOpenResponse.status}, sharedOpenUrl=${sharedOpenUrl}, localSharedOpenUrl=${localSharedOpenUrl}, body=${await shareOpenResponse.text()}`
      );
    }
    const sharedSessionCookie = extractCookie(shareOpenResponse.headers.get("set-cookie"));
    const sharedProbe = await requestJson({
      method: "GET",
      url: `${base}/probe?share=1`,
      expectedStatus: 200,
      headers: { cookie: sharedSessionCookie }
    });
    if (!String(sharedProbe.body?.cookie ?? "").includes("nextclaw_ui_bridge=smoke-bridge")) {
      throw new Error(`Expected bridged cookie for shared probe, got ${JSON.stringify(sharedProbe.body)}`);
    }
    await requestJson({
      method: "POST",
      url: `${base}/platform/remote/shares/${encodeURIComponent(grantId)}/revoke`,
      token: userToken,
      body: {},
      expectedStatus: 200
    });

    const revokedSharedProbe = await requestJson({
      method: "GET",
      url: `${base}/probe?share=2`,
      expectedStatus: 410,
      headers: { cookie: sharedSessionCookie }
    });
    if (typeof revokedSharedProbe.body !== "string" || !revokedSharedProbe.body.includes("revoked")) {
      throw new Error(`Expected revoked shared session response, got ${JSON.stringify(revokedSharedProbe.body)}`);
    }

    const revokedShareOpenApi = await requestJson({
      method: "POST",
      url: `${base}/platform/share/${encodeURIComponent(grantToken)}/open`,
      expectedStatus: 410
    });
    if (revokedShareOpenApi.status !== 410) {
      throw new Error(`Expected revoked share open API to return 410, got ${revokedShareOpenApi.status}`);
    }

    console.log("[remote-relay-smoke] stop connector and verify offline transition...");
    if (connectorProcess.exitCode === null && !connectorProcess.killed) {
      connectorProcess.kill("SIGTERM");
    }
    await waitFor(async () => {
      const instancesResponse = await requestJson({
        method: "GET",
        url: `${base}/platform/remote/instances`,
        token: userToken,
        expectedStatus: 200
      });
      const items = instancesResponse.body?.data?.items ?? [];
      return items.find((item) => item.id === instance.id && item.status === "offline") ?? null;
    }, 30_000, "connector offline");

    console.log("[remote-relay-smoke] all checks passed.");
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
    localUiWss.close();
    await new Promise((resolveClose) => localUiServer.close(() => resolveClose()));
    rmSync(persistDir, { recursive: true, force: true });
    rmSync(nextclawHome, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("[remote-relay-smoke] failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
