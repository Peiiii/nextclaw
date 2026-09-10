import { test } from "node:test";
import assert from "node:assert/strict";
import { selectFeedback } from "nextclaw";
const now = Date.now();
const report = (id, patch = {}) => ({ id, priority: 2, status: "received", runId: null, kind: "bug", identity: "anonymous", createdAt: new Date(now - 1000).toISOString(), ...patch });
test("severity outranks login, login breaks ties and never authorizes work", () => {
  const selected = selectFeedback([report("login", { identity: "verified" }), report("anon-critical", { priority: 0 }), report("anon")]);
  assert.deepEqual(selected.map((r) => r.id), ["anon-critical", "login", "anon"]);
});
test("an aged anonymous report gets a slot but does not displace critical incidents", () => {
  const old = report("old", { createdAt: new Date(now - 72 * 3600000).toISOString() });
  const recent = Array.from({ length: 10 }, (_, i) => report(String(i), { identity: "verified" }));
  assert.ok(selectFeedback([...recent, old], now).some((r) => r.id === "old"));
  assert.ok(!selectFeedback([...recent.map((r) => ({ ...r, priority: 0 })), old], now).some((r) => r.id === "old"));
});
test("running, withdrawn, resolved and needs-info reports do not loop", () => {
  assert.deepEqual(selectFeedback(["working", "withdrawn", "resolved", "needs-info", "ready"].map((status) => report(status, { status }))), []);
});
