import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, test } from "node:test";

const providerScript = resolve("skills/proxy-local-ai-subscriptions/scripts/nextclaw-provider.mjs");
const smokeScript = resolve("skills/proxy-local-ai-subscriptions/scripts/nextclaw-smoke.mjs");
const tempDirectories = [];
const servers = [];

function createTempDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "nextclaw-provider-proxy-"));
  tempDirectories.push(directory);
  return directory;
}

function runScript(script, args) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [script, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolveResult({ code, stdout, stderr }));
  });
}

function readRequestBody(request) {
  return new Promise((resolveBody) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => resolveBody(body ? JSON.parse(body) : null));
  });
}

function sendJson(response, payload, status = 200) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function listen(handler) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  return server.address().port;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolveClose) => server.close(resolveClose))));
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

async function createProviderHarness({ existing = null, testSuccess = true } = {}) {
  const directory = createTempDirectory();
  const keyPath = join(directory, "proxy-key");
  const apiKey = "nc_local_test_secret";
  writeFileSync(keyPath, `${apiKey}\n`, { mode: 0o600 });
  const requests = [];
  let provider = existing;
  let port;
  port = await listen(async (request, response) => {
    const body = await readRequestBody(request);
    requests.push({ method: request.method, url: request.url, body });
    if (request.method === "GET" && request.url === "/v1/models") {
      sendJson(response, { data: [{ id: "gpt-5.4-codex" }, { id: "gpt-5.3-codex" }] });
      return;
    }
    if (request.method === "GET" && request.url === "/api/providers") {
      sendJson(response, { ok: true, data: { providers: provider ? { "local-subscriptions": provider } : {} } });
      return;
    }
    if (request.method === "POST" && request.url === "/api/providers") {
      provider = { ...body, providerId: body.providerId };
      sendJson(response, { ok: true, data: { providerId: body.providerId, provider } });
      return;
    }
    if (request.method === "POST" && request.url === "/api/providers/local-subscriptions/test") {
      sendJson(response, {
        ok: true,
        data: {
          success: testSuccess,
          provider: "local-subscriptions",
          model: body.model,
          latencyMs: 12,
          message: testSuccess ? "Connection test passed." : "upstream rejected request",
        },
      });
      return;
    }
    if (request.method === "PUT" && request.url === "/api/providers/local-subscriptions") {
      provider = { ...body, providerId: "local-subscriptions" };
      sendJson(response, { ok: true, data: provider });
      return;
    }
    if (request.method === "DELETE" && request.url === "/api/providers/local-subscriptions") {
      provider = null;
      sendJson(response, { ok: true, data: { deleted: true, providerId: "local-subscriptions" } });
      return;
    }
    response.writeHead(404).end();
  });
  return {
    keyPath,
    requests,
    endpoint: `http://127.0.0.1:${port}/v1`,
    nextclawApi: `http://127.0.0.1:${port}/api`,
    provider: () => provider,
  };
}

test("new provider is tested while disabled and enabled only after success", async () => {
  const harness = await createProviderHarness();
  const result = await runScript(providerScript, [
    "--endpoint", harness.endpoint,
    "--api-key-file", harness.keyPath,
    "--nextclaw-api", harness.nextclawApi,
    "--model", "gpt-5.4-codex",
  ]);
  assert.equal(result.code, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.created, true);
  assert.equal(payload.scopedModel, "local-subscriptions/gpt-5.4-codex");
  const mutationRequests = harness.requests.filter((request) => request.url.startsWith("/api/providers"));
  assert.deepEqual(mutationRequests.map((request) => request.method), ["GET", "POST", "POST", "PUT"]);
  assert.equal(mutationRequests[1].body.enabled, false);
  assert.equal(mutationRequests[1].body.wireApi, "chat");
  assert.equal(mutationRequests[2].body.model, "local-subscriptions/gpt-5.4-codex");
  assert.equal(mutationRequests[3].body.enabled, true);
  assert.equal(harness.provider().enabled, true);
  assert.equal(result.stdout.includes("nc_local_test_secret"), false);
});

test("failed first-time provider test rolls creation back", async () => {
  const harness = await createProviderHarness({ testSuccess: false });
  const result = await runScript(providerScript, [
    "--endpoint", harness.endpoint,
    "--api-key-file", harness.keyPath,
    "--nextclaw-api", harness.nextclawApi,
  ]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Provider connection test failed/);
  assert.equal(harness.provider(), null);
  assert.deepEqual(
    harness.requests.filter((request) => request.url.startsWith("/api/providers")).map((request) => request.method),
    ["GET", "POST", "POST", "DELETE"],
  );
});

test("existing provider remains unchanged when candidate test fails", async () => {
  const existing = {
    providerId: "local-subscriptions",
    displayName: "Local AI Subscriptions",
    apiBase: "placeholder",
    enabled: true,
  };
  const harness = await createProviderHarness({ existing, testSuccess: false });
  existing.apiBase = harness.endpoint;
  const result = await runScript(providerScript, [
    "--endpoint", harness.endpoint,
    "--api-key-file", harness.keyPath,
    "--nextclaw-api", harness.nextclawApi,
  ]);
  assert.equal(result.code, 1);
  assert.equal(harness.provider(), existing);
  assert.deepEqual(
    harness.requests.filter((request) => request.url.startsWith("/api/providers")).map((request) => request.method),
    ["GET", "POST"],
  );
});

test("NCP smoke requires a real native-session marker", async () => {
  let streamResponse = null;
  const port = await listen(async (request, response) => {
    if (request.method === "GET" && request.url === "/api/ncp/session-types") {
      sendJson(response, { data: { options: [{ value: "native", ready: true }] } });
      return;
    }
    if (request.method === "GET" && request.url.startsWith("/api/ncp/agent/stream")) {
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      response.write(": connected\n\n");
      streamResponse = response;
      return;
    }
    if (request.method === "POST" && request.url === "/api/ncp/agent/send") {
      await readRequestBody(request);
      sendJson(response, { ok: true });
      streamResponse.write(`data: ${JSON.stringify({
        type: "message.completed",
        payload: { message: { parts: [{ type: "text", text: "NEXTCLAW_NCP_PROXY_OK" }] } },
      })}\n\n`);
      streamResponse.write(`data: ${JSON.stringify({ type: "run.finished", payload: {} })}\n\n`);
      streamResponse.end();
      return;
    }
    response.writeHead(404).end();
  });

  const result = await runScript(smokeScript, [
    "--nextclaw-api", `http://127.0.0.1:${port}/api`,
    "--model", "local-subscriptions/gpt-5.4-codex",
  ]);
  assert.equal(result.code, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.sessionType, "native");
  assert.equal(payload.assistantText, "NEXTCLAW_NCP_PROXY_OK");
  assert.equal(payload.terminalEvent, "run.finished");
});
