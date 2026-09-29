import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const publicHarness = await import("@nextclaw/harness");
const kernel = await import("@nextclaw/kernel");

test("exports only the intentional runtime surface", () => {
  assert.deepEqual(Object.keys(publicHarness).sort(), [
    "Contribution",
    "EventBus",
    "Ingress",
    "NextclawHarness",
    "NextclawHarnessError",
    "createNextclawApplication",
    "createTypedKey",
    "eventKeys",
    "ingressKeys",
    "runNextclawTask",
  ]);
});

test("published Node root prepares the full local product on the Harness graph", async () => {
  const homeDir = await mkdtemp(join(tmpdir(), "harness-full-product-"));
  await writeFile(join(homeDir, "config.json"), JSON.stringify({ agents: { defaults: { workspace: join(homeDir, "workspace") } } }));
  const app = await publicHarness.createNextclawApplication({ homeDir, sessionSearchEnabled: false, sessionTitleEnabled: false });
  try {
    await assert.rejects(app.harness.sessions.resume("before-start"), /must be started/);
    await app.harness.start();
    const session = await app.harness.agents.get().sessions.create({ sessionId: "full-product", task: "same owner" });
    assert.equal((await app.kernel.sessionManager.getSession(session.sessionId)).sessionId, session.sessionId);
    const tools = await app.kernel.toolProviderManager.buildTools({ channel: "ui", sessionId: session.sessionId, message: {
      id: "full-tools", sessionId: session.sessionId, role: "user", status: "final", parts: [], timestamp: new Date().toISOString(),
    } });
    const names = new Set(tools.map((tool) => tool.name));
    for (const name of ["read_file", "write_file", "exec", "web_search", "sessions_spawn", "request_user_input_async"]) {
      assert.ok(names.has(name), `full product must retain ${name}`);
    }
  } finally { await app.harness.dispose(); await rm(homeDir, { recursive: true, force: true }); }
});

test("delegates runtime ownership to the kernel harness", () => {
  assert.equal(
    publicHarness.NextclawHarness,
    kernel.NextclawHarness,
  );
  assert.equal(publicHarness.Contribution, kernel.Contribution);
  assert.equal(publicHarness.EventBus, kernel.EventBus);
  assert.equal(publicHarness.Ingress, kernel.Ingress);
  assert.equal(publicHarness.eventKeys, kernel.eventKeys);
  assert.equal(publicHarness.ingressKeys, kernel.ingressKeys);
  assert.equal(
    publicHarness.NextclawHarnessError,
    kernel.NextclawHarnessError,
  );
});

test("published roots compose a Node platform and resume persisted sessions", async () => {
  const homeDir = await mkdtemp(join(tmpdir(), "harness-public-node-"));
  await writeFile(join(homeDir, "config.json"), JSON.stringify({ agents: { defaults: { workspace: join(homeDir, "workspace") } } }));
  const options = { homeDir, sessionSearchEnabled: false, sessionTitleEnabled: false };
  let harness = new publicHarness.NextclawHarness({ platform: new kernel.NodePlatform(options) });
  try {
    await harness.start();
    const created = await harness.agents.get().sessions.create({ sessionId: "public-sdk", task: "persist this task" });
    assert.equal(created.sessionId, "public-sdk");
    await harness.dispose();
    harness = new publicHarness.NextclawHarness({ platform: new kernel.NodePlatform(options) });
    await harness.start();
    assert.equal((await harness.sessions.resume("public-sdk")).sessionId, "public-sdk");
  } finally { await harness.dispose(); await rm(homeDir, { recursive: true, force: true }); }
});
