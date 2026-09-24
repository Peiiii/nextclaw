import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { once } from "node:events";
import test from "node:test";

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  server.close();
  await once(server, "close");
  return port;
}

async function waitForHealth(port) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return;
    } catch { /* The runner is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail("runner did not start");
}

async function verifyArchive(temporary, response) {
  const archive = join(temporary, "snapshot.tgz");
  const restored = join(temporary, "restored");
  await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  await mkdir(restored);
  execFileSync("tar", ["-xzf", archive, "-C", restored]);
  assert.equal(await readFile(join(restored, "workspace", "note.txt"), "utf8"), "persist me");
  await assert.rejects(readFile(join(restored, "config.json")), { code: "ENOENT" });
  const restoredJournal = join(restored, "sessions", ".ncp-agent-journal");
  await assert.rejects(readFile(join(restoredJournal, ".ncp-agent-session-catalog.sqlite-wal")), { code: "ENOENT" });
  const restoredDatabase = new DatabaseSync(join(restoredJournal, ".ncp-agent-session-catalog.sqlite"), { readOnly: true });
  try {
    assert.equal(restoredDatabase.prepare("PRAGMA quick_check").get().quick_check, "ok");
    assert.ok(restoredDatabase.prepare("SELECT COUNT(*) AS count FROM entries").get().count > 0);
  } finally { restoredDatabase.close(); }
}

test("snapshot stays valid while NextClaw's SQLite WAL is being written", async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "bibo-snapshot-test-"));
  const home = join(temporary, "home");
  const journal = join(home, "sessions", ".ncp-agent-journal");
  await mkdir(journal, { recursive: true });
  await mkdir(join(home, "workspace"));
  await writeFile(join(home, "workspace", "note.txt"), "persist me");
  await writeFile(join(home, "config.json"), "private config");
  await writeFile(join(home, "workspace", "padding.bin"), randomBytes(3 * 1024 * 1024));

  const databasePath = join(journal, ".ncp-agent-session-catalog.sqlite");
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA journal_mode=WAL; CREATE TABLE entries (value TEXT)");
  const insert = database.prepare("INSERT INTO entries (value) VALUES (?)");
  const port = await freePort();
  const runner = spawn(process.execPath, [new URL("./bibo-runner.controller.mjs", import.meta.url).pathname], {
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
  const writer = setInterval(() => { insert.run(String(++writes)); }, 1);
  let response;
  try { response = await fetch(`http://127.0.0.1:${port}/snapshot`); }
  finally { clearInterval(writer); }
  assert.equal(response.status, 200);
  assert.ok(writes > 0, "WAL changed during the snapshot");

  await verifyArchive(temporary, response);
});
