import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { once } from "node:events";
import test from "node:test";
import { NextclawHarness } from "@nextclaw/harness";

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  server.close();
  await once(server, "close");
  return port;
}

async function waitForHealth(port: number): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return;
    } catch { /* The runner is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail("runner did not start");
}

async function verifyArchive(temporary: string, response: Response): Promise<void> {
  const archive = join(temporary, "snapshot.tgz");
  const restored = join(temporary, "restored");
  await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  await mkdir(restored);
  execFileSync("tar", ["-xzf", archive, "-C", restored]);
  assert.equal(await readFile(join(restored, "workspace", "note.txt"), "utf8"), "persist me");
  await assert.rejects(readFile(join(restored, "config.json")), { code: "ENOENT" });
  const restoredJournal = join(restored, "sessions", ".ncp-agent-journal");
  assert.equal(await readFile(join(restoredJournal, "session.jsonl"), "utf8"), "canonical journal\n");
  await assert.rejects(readdir(join(restoredJournal, ".message-projections")), { code: "ENOENT" });
  assert.equal(await readFile(join(restored, "workspace", ".message-projections", "user.txt"), "utf8"), "user data");
  await assert.rejects(readFile(join(restoredJournal, ".ncp-agent-session-catalog.sqlite-wal")), { code: "ENOENT" });
  const restoredDatabase = new DatabaseSync(join(restoredJournal, ".ncp-agent-session-catalog.sqlite"), { readOnly: true });
  try {
    assert.equal((restoredDatabase.prepare("PRAGMA quick_check").get() as { quick_check: string }).quick_check, "ok");
    assert.ok((restoredDatabase.prepare("SELECT COUNT(*) AS count FROM entries").get() as { count: number }).count > 0);
  } finally { restoredDatabase.close(); }
}

test("snapshot preserves canonical data while SQLite WAL and message projections are being written", async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "bibo-snapshot-test-"));
  const home = join(temporary, "home");
  const journal = join(home, "sessions", ".ncp-agent-journal");
  await mkdir(journal, { recursive: true });
  await mkdir(join(home, "workspace"));
  const projection = join(journal, ".message-projections", "session");
  await mkdir(projection, { recursive: true });
  await writeFile(join(journal, "session.jsonl"), "canonical journal\n");
  await mkdir(join(home, "workspace", ".message-projections"));
  await writeFile(join(home, "workspace", ".message-projections", "user.txt"), "user data");
  await writeFile(join(home, "workspace", "note.txt"), "persist me");
  await writeFile(join(home, "config.json"), "private config");
  await writeFile(join(home, "workspace", "padding.bin"), randomBytes(3 * 1024 * 1024));

  const databasePath = join(journal, ".ncp-agent-session-catalog.sqlite");
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA journal_mode=WAL; CREATE TABLE entries (value TEXT)");
  const insert = database.prepare("INSERT INTO entries (value) VALUES (?)");
  const port = await freePort();
  const runner = spawn(process.execPath, [new URL("../dist/container/bibo-runner.controller.mjs", import.meta.url).pathname], {
    env: { ...process.env, NEXTCLAW_HOME: home, BIBO_PORT: String(port) },
    stdio: "ignore",
  });
  t.after(async () => {
    if (runner.exitCode === null && runner.signalCode === null) {
      const exited = once(runner, "exit");
      runner.kill();
      await exited;
    }
    database.close();
    await rm(temporary, { recursive: true, force: true });
  });

  await waitForHealth(port);

  let writes = 0;
  let stagedMetadata: string[] = [];
  // Exercise the production write/rename race, not just SQLite sidecars.
  const writer = setInterval(() => {
    insert.run(String(++writes));
    for (const staged of stagedMetadata) renameSync(staged, join(projection, "meta.json"));
    stagedMetadata = [];
    for (let index = 0; index < 64; index += 1) {
      const staged = join(projection, `meta.json.${process.pid}.${randomUUID()}.tmp`);
      writeFileSync(staged, JSON.stringify({ writes }));
      stagedMetadata.push(staged);
    }
  }, 1);
  let response;
  try { response = await fetch(`http://127.0.0.1:${port}/snapshot`); }
  finally { clearInterval(writer); }
  assert.equal(response.status, 200, response.ok ? undefined : await response.text());
  assert.ok(writes > 0, "WAL changed during the snapshot");

  await verifyArchive(temporary, response);

  const exited = once(runner, "exit");
  runner.kill("SIGTERM");
  assert.deepEqual(await exited, [0, null], "idle runner exits cleanly when Cloudflare stops it");
});

async function verifyFailedRun(port: number): Promise<void> {
  const failed = await fetch(`http://127.0.0.1:${port}/run`, { method: "POST", headers: { accept: "text/event-stream", "x-bibo-run-id": "failed-run" }, body: JSON.stringify({ message: "failure", token: "account-token", sessionId: "runner-test-session" }) });
  const failedBody = await failed.text();
  assert.equal(failed.status, 200);
  assert.match(failedBody, /MODEL_INPUT_TOO_LARGE/);
  assert.match(failedBody, /failed-run/);
  assert.doesNotMatch(failedBody, /private-upstream-content/);
}

test("runner configures authenticated search and updates only built-in identities", async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "bibo-search-runner-"));
  const home = join(temporary, "home");
  await mkdir(join(home, "workspace"), { recursive: true });
  const identity = join(home, "workspace", "IDENTITY.md");
  const original = "# Bibo\n\n你是 Bibo，基于 NextClaw 的个人 AI 搭档。诚实说明已完成、未完成以及不确定的事。这个托管网页当前提供文字对话和会话继续；不要声称已经接入网页搜索、邮箱、自动提醒、后台任务或外部应用。未经用户授权，不对外操作。用户决定哪些个人信息值得记住。\n";
  await writeFile(identity, original);
  const loader = join(temporary, "harness-loader.mjs");
  const fixture = `export class Contribution {}; export const eventKeys = { uiShowContent: "ui.show-content" };
    export class NextclawHarness {
      contributions = { register() {} }; async start() {} async dispose() {}
      async runTask(input) {
        if (input.input === 'failure') throw new Error('Chat Completions API failed (413): private-upstream-content');
        input.onEvent?.({ type: 'message.sent', payload: { message: { metadata: {
          nextclaw_timeline_kind: 'context_compaction', checkpoint: { status: 'compressed', phase: 'pre-run', summary: 'private-summary' }
        } } } });
        return { text: 'fixture answer', sessionId: 'fixture-session' };
      }
    }`;
  await writeFile(loader, `export async function resolve(specifier, context, next) {
    if (specifier === "@nextclaw/harness") return { url: ${JSON.stringify(`data:text/javascript,${encodeURIComponent(fixture)}`)}, shortCircuit: true };
    return next(specifier, context);
  }`);
  const port = await freePort();
  const runner = spawn(process.execPath, ["--experimental-loader", loader, new URL("../dist/container/bibo-runner.controller.mjs", import.meta.url).pathname], {
    env: { ...process.env, NEXTCLAW_HOME: home, BIBO_PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"],
  });
  let runnerLogs = "";
  runner.stdout.on("data", (chunk) => { runnerLogs += chunk.toString(); });
  runner.stderr.on("data", (chunk) => { runnerLogs += chunk.toString(); });
  t.after(async () => {
    if (runner.exitCode === null && runner.signalCode === null) { const exited = once(runner, "exit"); runner.kill(); await exited; }
    await rm(temporary, { recursive: true, force: true });
  });
  await waitForHealth(port);
  const run = async (searchEnabled: boolean) => {
    const response = await fetch(`http://127.0.0.1:${port}/run`, {
      method: "POST", headers: { "x-bibo-run-id": "runner-test-run", "x-bibo-session-id": "runner-test-session" }, body: JSON.stringify({ message: "Find official sources", token: "account-token", sessionId: "runner-test-session", searchEnabled }),
    });
    assert.equal(response.status, 200);
    return JSON.parse(await readFile(join(home, "config.json"), "utf8")) as { search: { enabledProviders: string[]; defaults: { maxResults: number }; providers: { exa: { apiKey: string; baseUrl: string } } } };
  };
  const configured = await run(true);
  assert.deepEqual(configured.search.enabledProviders, ["exa"]);
  assert.equal(configured.search.defaults.maxResults, 10);
  assert.equal(configured.search.providers.exa.apiKey, "account-token");
  assert.equal(configured.search.providers.exa.baseUrl, "https://app.bibo.bot/api/search/exa");
  assert.match(await readFile(identity, "utf8"), /Exa 网页搜索/);
  assert.match(await readFile(identity, "utf8"), /file.create/);
  assert.doesNotMatch(await readFile(identity, "utf8"), /不要声称已经接入网页搜索/);
  const disabled = await run(false);
  assert.deepEqual(disabled.search.enabledProviders, []);
  assert.equal(disabled.search.providers.exa.apiKey, "");
  assert.doesNotMatch(await readFile(identity, "utf8"), /支持 Exa 网页搜索/);
  await rm(identity);
  await run(true);
  assert.match(await readFile(identity, "utf8"), /Exa 网页搜索/);
  const customized = "# My Bibo\nKeep my personal identity.";
  await writeFile(identity, customized);
  await run(true);
  assert.equal(await readFile(identity, "utf8"), customized);
  const config = JSON.parse(await readFile(join(home, "config.json"), "utf8"));
  assert.equal(config.providers.nextclaw.extraHeaders["x-bibo-run-id"], "runner-test-run");
  assert.equal(config.providers.nextclaw.extraHeaders["x-bibo-session-id"], "runner-test-session");
  await verifyFailedRun(port);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.match(runnerLogs, /"compactionStatus":"compressed"/);
  assert.match(runnerLogs, /"errorCode":"MODEL_INPUT_TOO_LARGE"/);
  assert.doesNotMatch(runnerLogs, /private-summary|private-upstream-content|account-token/);
});

test("Bibo structured data and file content survive a runner snapshot restore", async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "bibo-space-restore-"));
  const home = join(temporary, "home");
  await mkdir(join(home, "workspace"), { recursive: true });
  const port = await freePort();
  const runner = spawn(process.execPath, [new URL("../dist/container/bibo-runner.controller.mjs", import.meta.url).pathname], {
    env: { ...process.env, NEXTCLAW_HOME: home, BIBO_PORT: String(port) }, stdio: "ignore",
  });
  t.after(async () => {
    if (runner.exitCode === null && runner.signalCode === null) { const exited = once(runner, "exit"); runner.kill(); await exited; }
    await rm(temporary, { recursive: true, force: true });
  });
  await waitForHealth(port);
  const action = async (name: string, input: Record<string, unknown>) => {
    const response = await fetch(`http://127.0.0.1:${port}/space`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: name, input }) });
    assert.equal(response.status, 200);
    return (await response.json() as { result: unknown }).result;
  };
  const task = await action("task.create", { title: "Restore this task", status: "active" }) as { id: string };
  const file = await action("file.create", { path: "Ideas.md", kind: "note", content: "Persistent note" }) as { id: string };
  const snapshot = await fetch(`http://127.0.0.1:${port}/snapshot`);
  assert.equal(snapshot.status, 200);
  await rm(join(home, "bibo"), { recursive: true, force: true });
  await rm(join(home, "workspace", "Ideas.md"));
  const restored = await fetch(`http://127.0.0.1:${port}/restore`, { method: "POST", body: await snapshot.arrayBuffer() });
  assert.equal(restored.status, 200);
  assert.equal((await action("task.get", { id: task.id }) as { title: string }).title, "Restore this task");
  assert.equal((await action("file.get", { id: file.id }) as { content: string }).content, "Persistent note");
});

test("deleting a Bibo session removes the underlying Agent journal", async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "bibo-session-delete-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const sessionId = "bibo-delete-fixture";
  const createHarness = new NextclawHarness({ homeDir: temporary });
  await createHarness.start();
  try { await createHarness.agents.get().sessions.create({ sessionId, task: "fixture" }); }
  finally { await createHarness.dispose(); }

  const port = await freePort();
  const runner = spawn(process.execPath, [new URL("../dist/container/bibo-runner.controller.mjs", import.meta.url).pathname], {
    env: { ...process.env, NEXTCLAW_HOME: temporary, BIBO_PORT: String(port) }, stdio: "ignore",
  });
  t.after(async () => { if (runner.exitCode === null && runner.signalCode === null) { const exited = once(runner, "exit"); runner.kill(); await exited; } });
  await waitForHealth(port);
  const deleted = await fetch(`http://127.0.0.1:${port}/sessions/delete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: sessionId }) });
  assert.equal(deleted.status, 200);

  const inspectHarness = new NextclawHarness({ homeDir: temporary });
  await inspectHarness.start();
  try { await assert.rejects(inspectHarness.sessions.resume(sessionId)); }
  finally { await inspectHarness.dispose(); }
});
