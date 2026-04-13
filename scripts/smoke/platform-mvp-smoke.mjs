#!/usr/bin/env node
import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import { exerciseUserAuthFlows } from "./platform-mvp-auth-smoke-support.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workerDir = resolve(rootDir, "workers/nextclaw-provider-gateway-api");
const workerConfig = resolve(workerDir, "wrangler.toml");
const wranglerBin = resolve(
  workerDir,
  "node_modules/.bin",
  process.platform === "win32" ? "wrangler.cmd" : "wrangler"
);

function runOrThrow(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: rootDir,
    encoding: "utf-8",
    stdio: "pipe",
    ...options
  });
  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${cmd} ${args.join(" ")}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }
  return result;
}

function encodeBase64Url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, 100_000, 32, "sha256");
  return {
    salt: encodeBase64Url(salt),
    hash: encodeBase64Url(hash)
  };
}

function buildSeedUserSql(users) {
  const now = new Date().toISOString();
  const inserts = users.map((user) => {
    const digest = hashPassword(user.password);
    return `INSERT INTO users (
      id, email, password_hash, password_salt, role,
      free_limit_usd, free_used_usd, paid_balance_usd,
      created_at, updated_at
    ) VALUES (
      '${randomUUID()}',
      '${user.email}',
      '${digest.hash}',
      '${digest.salt}',
      '${user.role}',
      ${user.freeLimitUsd},
      0,
      ${user.paidBalanceUsd},
      '${now}',
      '${now}'
    );`;
  });
  return inserts.join("\n");
}

function findFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate free port."));
        return;
      }
      const port = address.port;
      server.close(() => resolvePort(port));
    });
    server.on("error", reject);
  });
}

async function waitForHealth(url, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // ignore while booting
    }
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 300));
  }
  throw new Error(`Health check timeout: ${url}`);
}

async function requestJson({
  method,
  url,
  token,
  body,
  expectedStatus
}) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let parsed = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  if (typeof expectedStatus === "number" && response.status !== expectedStatus) {
    throw new Error(
      `Unexpected status for ${method} ${url}: expected ${expectedStatus}, got ${response.status}, body=${JSON.stringify(parsed)}`
    );
  }
  return { status: response.status, body: parsed };
}

async function main() {
  const persistDir = mkdtempSync(resolve(tmpdir(), "nextclaw-platform-smoke-"));
  const envFile = resolve(persistDir, ".smoke.env");
  const backendPort = await findFreePort();
  const mockUpstreamPort = await findFreePort();
  const base = `http://127.0.0.1:${backendPort}`;
  const mockBase = `http://127.0.0.1:${mockUpstreamPort}/compatible-mode/v1`;
  const now = Date.now();
  const adminEmail = `admin.${now}@example.com`;
  const userEmail = `user.${now}@example.com`;
  const lockUserEmail = `lock.${now}@example.com`;
  const password = "Passw0rd!";
  const resetPassword = "ResetPassw0rd!";

  const upstreamServer = createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/compatible-mode/v1/chat/completions") {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf-8");
        const payload = raw.length > 0 ? JSON.parse(raw) : {};
        const requestedModel = typeof payload.model === "string" ? payload.model : "qwen3.5-plus";
        const responseBody = {
          id: `chatcmpl-smoke-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: requestedModel,
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "smoke-ok"
              }
            }
          ],
          usage: {
            prompt_tokens: 1200,
            completion_tokens: 300,
            total_tokens: 1500
          }
        };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(responseBody));
      });
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  await new Promise((resolveListen, rejectListen) => {
    upstreamServer.once("error", rejectListen);
    upstreamServer.listen(mockUpstreamPort, "127.0.0.1", () => resolveListen());
  });
  writeFileSync(envFile, [
    "AUTH_TOKEN_SECRET=smoke-token-secret-with-length-at-least-32",
    "DASHSCOPE_API_KEY=smoke-upstream-key",
    `DASHSCOPE_API_BASE=${mockBase}`,
    "GLOBAL_FREE_USD_LIMIT=20",
    "REQUEST_FLAT_USD_PER_REQUEST=0.0002",
    "PLATFORM_AUTH_EMAIL_PROVIDER=console",
    "PLATFORM_AUTH_DEV_EXPOSE_CODE=true"
  ].join("\n"), "utf-8");
  let workerProcess = null;
  try {
    console.log("[platform-smoke] apply local migrations...");
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

    const seedSqlFile = resolve(persistDir, "seed-users.sql");
    writeFileSync(seedSqlFile, buildSeedUserSql([
      { email: adminEmail, password, role: "admin", freeLimitUsd: 2, paidBalanceUsd: 0 },
      { email: lockUserEmail, password, role: "user", freeLimitUsd: 2, paidBalanceUsd: 0 }
    ]), "utf-8");

    runOrThrow(wranglerBin, [
      "d1",
      "execute",
      "NEXTCLAW_PLATFORM_DB",
      "--local",
      "--config",
      workerConfig,
      "--persist-to",
      persistDir,
      "--file",
      seedSqlFile
    ]);

    console.log("[platform-smoke] start worker...");
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

    let workerLogs = "";
    const captureLog = (chunk) => {
      const text = String(chunk ?? "");
      workerLogs += text;
      if (workerLogs.length > 20_000) {
        workerLogs = workerLogs.slice(-20_000);
      }
    };
    workerProcess.stdout?.on("data", captureLog);
    workerProcess.stderr?.on("data", captureLog);

    await waitForHealth(`${base}/health`);

    console.log("[platform-smoke] login admin + register/login/reset user...");
    const adminLogin = await requestJson({
      method: "POST",
      url: `${base}/platform/auth/login`,
      body: { email: adminEmail, password },
      expectedStatus: 200
    });
    if (adminLogin.body?.data?.user?.role !== "admin") {
      throw new Error(`Expected admin role, got: ${JSON.stringify(adminLogin.body)}`);
    }
    const adminToken = adminLogin.body?.data?.token;
    if (!adminToken) {
      throw new Error("Missing admin token after login.");
    }

    const { userId, userToken } = await exerciseUserAuthFlows({
      base,
      email: userEmail,
      password,
      resetPassword,
      requestJson
    });

    console.log("[platform-smoke] verify failed-login lockout...");
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await requestJson({
        method: "POST",
        url: `${base}/platform/auth/login`,
        body: { email: lockUserEmail, password: `${password}-wrong` },
        expectedStatus: 401
      });
    }
    await requestJson({
      method: "POST",
      url: `${base}/platform/auth/login`,
      body: { email: lockUserEmail, password: `${password}-wrong` },
      expectedStatus: 423
    });

    console.log("[platform-smoke] verify login required + admin role check...");
    await requestJson({
      method: "GET",
      url: `${base}/platform/billing/overview`,
      expectedStatus: 401
    });
    await requestJson({
      method: "GET",
      url: `${base}/platform/admin/overview`,
      token: userToken,
      expectedStatus: 403
    });

    console.log("[platform-smoke] create + approve recharge intent...");
    const createIntent = await requestJson({
      method: "POST",
      url: `${base}/platform/billing/recharge-intents`,
      token: userToken,
      body: { amountUsd: 10, note: "smoke recharge" },
      expectedStatus: 201
    });
    const intentId = createIntent.body?.data?.id;
    if (!intentId) {
      throw new Error("Recharge intent id missing.");
    }
    await requestJson({
      method: "POST",
      url: `${base}/platform/admin/recharge-intents/${encodeURIComponent(intentId)}/confirm`,
      token: adminToken,
      body: {},
      expectedStatus: 200
    });

    const overviewAfterRecharge = await requestJson({
      method: "GET",
      url: `${base}/platform/billing/overview`,
      token: userToken,
      expectedStatus: 200
    });
    const paidAfterRecharge = overviewAfterRecharge.body?.data?.user?.paidBalanceUsd ?? 0;
    if (paidAfterRecharge < 10) {
      throw new Error(`Expected paid balance >= 10 after recharge, got ${paidAfterRecharge}`);
    }

    console.log("[platform-smoke] verify admin user quota management...");
    await requestJson({
      method: "PATCH",
      url: `${base}/platform/admin/users/${encodeURIComponent(userId)}`,
      token: adminToken,
      body: { freeLimitUsd: 1.5 },
      expectedStatus: 200
    });

    console.log("[platform-smoke] verify dual-free-limit hard block...");
    await requestJson({
      method: "PATCH",
      url: `${base}/platform/admin/settings`,
      token: adminToken,
      body: { globalFreeLimitUsd: 0 },
      expectedStatus: 200
    });
    await requestJson({
      method: "PATCH",
      url: `${base}/platform/admin/users/${encodeURIComponent(userId)}`,
      token: adminToken,
      body: { freeLimitUsd: 2, paidBalanceDeltaUsd: -10 },
      expectedStatus: 200
    });
    const blockedChat = await requestJson({
      method: "POST",
      url: `${base}/v1/chat/completions`,
      token: userToken,
      body: {
        model: "dashscope/qwen3.5-plus",
        messages: [{ role: "user", content: "hello" }]
      },
      expectedStatus: 429
    });
    if (blockedChat.body?.error?.code !== "insufficient_quota") {
      throw new Error(`Expected insufficient_quota, got ${JSON.stringify(blockedChat.body)}`);
    }

    console.log("[platform-smoke] verify paid balance direct deduction...");
    await requestJson({
      method: "PATCH",
      url: `${base}/platform/admin/users/${encodeURIComponent(userId)}`,
      token: adminToken,
      body: { freeLimitUsd: 0, paidBalanceDeltaUsd: 1 },
      expectedStatus: 200
    });
    const beforePaidOverview = await requestJson({
      method: "GET",
      url: `${base}/platform/billing/overview`,
      token: userToken,
      expectedStatus: 200
    });
    const paidBeforeUsage = beforePaidOverview.body?.data?.user?.paidBalanceUsd ?? 0;
    const usageFreeBefore = beforePaidOverview.body?.data?.user?.freeUsedUsd ?? 0;

    await requestJson({
      method: "POST",
      url: `${base}/v1/chat/completions`,
      token: userToken,
      body: {
        model: "dashscope/qwen3.5-plus",
        messages: [{ role: "user", content: "charge from paid balance" }],
        max_tokens: 300
      },
      expectedStatus: 200
    });

    const afterPaidOverview = await requestJson({
      method: "GET",
      url: `${base}/platform/billing/overview`,
      token: userToken,
      expectedStatus: 200
    });
    const paidAfterUsage = afterPaidOverview.body?.data?.user?.paidBalanceUsd ?? 0;
    const usageFreeAfter = afterPaidOverview.body?.data?.user?.freeUsedUsd ?? 0;
    if (!(paidAfterUsage < paidBeforeUsage)) {
      throw new Error(`Expected paid balance deduction, before=${paidBeforeUsage}, after=${paidAfterUsage}`);
    }
    if (usageFreeAfter !== usageFreeBefore) {
      throw new Error(`Expected free usage unchanged in paid-only mode, before=${usageFreeBefore}, after=${usageFreeAfter}`);
    }

    const ledger = await requestJson({
      method: "GET",
      url: `${base}/platform/billing/ledger?limit=20`,
      token: userToken,
      expectedStatus: 200
    });
    const items = ledger.body?.data?.items ?? [];
    const hasRecharge = items.some((item) => item.kind === "recharge" && item.amountUsd > 0);
    const usagePaidItem = items.find((item) => item.kind === "usage_paid" && item.paidAmountUsd > 0);
    if (!hasRecharge) {
      throw new Error("Expected recharge ledger entry.");
    }
    if (!usagePaidItem) {
      throw new Error(`Expected usage_paid ledger entry, got ${JSON.stringify(items)}`);
    }

    console.log("[platform-smoke] verify immutable ledger at DB level...");
    const attack = spawnSync(
      wranglerBin,
      [
        "d1",
        "execute",
        "NEXTCLAW_PLATFORM_DB",
        "--local",
        "--config",
        workerConfig,
        "--persist-to",
        persistDir,
        "--command",
        `UPDATE usage_ledger SET note = 'tamper' WHERE id = '${usagePaidItem.id}'`
      ],
      {
        cwd: rootDir,
        encoding: "utf-8",
        stdio: "pipe"
      }
    );
    const attackOutput = `${attack.stdout}\n${attack.stderr}`;
    if (attack.status === 0 || !attackOutput.includes("usage_ledger is immutable")) {
      throw new Error(`Expected immutable trigger rejection, got status=${attack.status}, output=${attackOutput}`);
    }

    console.log("[platform-smoke] all checks passed.");
  } catch (error) {
    throw error;
  } finally {
    if (workerProcess && workerProcess.exitCode === null && !workerProcess.killed) {
      workerProcess.kill("SIGTERM");
      await new Promise((resolveWait) => setTimeout(resolveWait, 800));
      if (workerProcess.exitCode === null && !workerProcess.killed) {
        workerProcess.kill("SIGKILL");
      }
    }
    await new Promise((resolveClose) => upstreamServer.close(() => resolveClose()));
    rmSync(persistDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("[platform-smoke] failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
