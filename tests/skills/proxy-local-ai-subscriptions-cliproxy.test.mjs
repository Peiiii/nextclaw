import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, test } from "node:test";

const scriptPath = resolve("skills/proxy-local-ai-subscriptions/scripts/cliproxy.mjs");
const tempDirectories = [];
const servers = [];

function createTempDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "nextclaw-subscription-proxy-"));
  tempDirectories.push(directory);
  return directory;
}

function runScript(args) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolveResult({ code, stdout, stderr }));
  });
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

test("write-config is secure, secret-free, and idempotent", async () => {
  const directory = createTempDirectory();
  const configPath = join(directory, "config.yaml");
  const authDir = join(directory, "auth");
  const keyPath = join(authDir, "nextclaw-api-key");
  const args = [
    "write-config",
    "--config", configPath,
    "--auth-dir", authDir,
    "--api-key-file", keyPath,
  ];

  const first = await runScript(args);
  assert.equal(first.code, 0, first.stderr);
  const firstPayload = JSON.parse(first.stdout);
  const apiKey = readFileSync(keyPath, "utf8").trim();
  const config = readFileSync(configPath, "utf8");
  assert.equal(firstPayload.changed, true);
  assert.equal(first.stdout.includes(apiKey), false);
  assert.match(config, /^host: "127\.0\.0\.1"$/m);
  assert.match(config, /^\s*secret-key: ""$/m);
  assert.match(config, /^\s*disable-control-panel: true$/m);
  assert.equal(statSync(configPath).mode & 0o777, 0o600);
  assert.equal(statSync(keyPath).mode & 0o777, 0o600);

  const second = await runScript(args);
  assert.equal(second.code, 0, second.stderr);
  assert.equal(JSON.parse(second.stdout).changed, false);
  assert.equal(readFileSync(keyPath, "utf8").trim(), apiKey);
});

test("write-config refuses unmanaged files unless force creates a backup", async () => {
  const directory = createTempDirectory();
  const configPath = join(directory, "config.yaml");
  const authDir = join(directory, "auth");
  writeFileSync(configPath, "host: 127.0.0.1\ncustom: true\n", "utf8");

  const blocked = await runScript([
    "write-config", "--config", configPath, "--auth-dir", authDir,
  ]);
  assert.equal(blocked.code, 1);
  assert.match(blocked.stderr, /Refusing to overwrite/);
  assert.equal(readFileSync(configPath, "utf8"), "host: 127.0.0.1\ncustom: true\n");

  const forced = await runScript([
    "write-config", "--config", configPath, "--auth-dir", authDir, "--force",
  ]);
  assert.equal(forced.code, 0, forced.stderr);
  const payload = JSON.parse(forced.stdout);
  assert.ok(payload.backupPath);
  assert.equal(readFileSync(payload.backupPath, "utf8"), "host: 127.0.0.1\ncustom: true\n");
});

test("check and Responses smoke validate a real compatible HTTP contract", async () => {
  const directory = createTempDirectory();
  const configPath = join(directory, "config.yaml");
  const authDir = join(directory, "auth");
  const keyPath = join(authDir, "nextclaw-api-key");
  const binaryPath = join(directory, "cliproxyapi");
  writeFileSync(binaryPath, "#!/bin/sh\necho 'CLIProxyAPI Version: 7.2.90, Commit: test'\n", "utf8");
  chmodSync(binaryPath, 0o700);
  const configured = await runScript([
    "write-config", "--config", configPath, "--auth-dir", authDir, "--api-key-file", keyPath,
  ]);
  assert.equal(configured.code, 0, configured.stderr);
  const apiKey = readFileSync(keyPath, "utf8").trim();
  const port = await listen(async (request, response) => {
    if (request.headers.authorization !== `Bearer ${apiKey}`) {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "unauthorized" } }));
      return;
    }
    if (request.method === "GET" && request.url === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "gpt-5.4-codex" }] }));
      return;
    }
    if (request.method === "POST" && request.url === "/v1/responses") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ output_text: "NEXTCLAW_PROXY_OK" }));
      return;
    }
    response.writeHead(404).end();
  });
  const endpoint = `http://127.0.0.1:${port}/v1`;

  const checked = await runScript([
    "check", "--binary", binaryPath, "--config", configPath,
    "--endpoint", endpoint, "--api-key-file", keyPath,
  ]);
  assert.equal(checked.code, 0, checked.stderr);
  assert.deepEqual(JSON.parse(checked.stdout).models, ["gpt-5.4-codex"]);

  const smoked = await runScript([
    "smoke", "--endpoint", endpoint, "--api-key-file", keyPath,
    "--model", "gpt-5.4-codex",
  ]);
  assert.equal(smoked.code, 0, smoked.stderr);
  assert.equal(JSON.parse(smoked.stdout).assistantText, "NEXTCLAW_PROXY_OK");
});

test("check blocks versions outside the audited family by default", async () => {
  const directory = createTempDirectory();
  const configPath = join(directory, "config.yaml");
  const authDir = join(directory, "auth");
  const keyPath = join(authDir, "nextclaw-api-key");
  const binaryPath = join(directory, "cliproxyapi");
  writeFileSync(binaryPath, "#!/bin/sh\necho 'CLIProxyAPI Version: 8.0.0, Commit: test'\n", "utf8");
  chmodSync(binaryPath, 0o700);
  await runScript(["write-config", "--config", configPath, "--auth-dir", authDir, "--api-key-file", keyPath]);

  const result = await runScript([
    "check", "--binary", binaryPath, "--config", configPath,
    "--endpoint", "http://127.0.0.1:8317/v1", "--api-key-file", keyPath,
  ]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /outside the audited 7\.2\.x family/);
});
