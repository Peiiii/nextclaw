import { test } from "node:test";
import assert from "node:assert/strict";
import { FeedbackDeliveryService, validateFeedbackBatch } from "../src/services/feedback-delivery.service.mjs";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateFeedbackPaths } from "../src/configs/feedback-policy.config.mjs";
const a = "a".repeat(40), b = "b".repeat(40), c = "c".repeat(40);
const batch = { baselineSha: a, headSha: c, approvedCommits: [b, c], target: "product", reports: [
  { id: "one", runId: "run-one", inputVersion: 1, fixedCommit: b },
  { id: "two", runId: "run-two", inputVersion: 2, fixedCommit: c }
] };
const reports = batch.reports.map((r) => ({ ...r, status: "ready", approval: { authority: "deliver", inputVersion: r.inputVersion } }));
test("release reconciliation returns facts without writing feedback or composing comments", async () => {
  const directory = await mkdtemp(join(tmpdir(), "feedback-release-"));
  try {
    const file = join(directory, "journal.json");
    await writeFile(file, JSON.stringify({ batch, state: "dispatched" }));
    const service = new FeedbackDeliveryService({ repository: directory, githubRepository: "example/repo",
      client: { scan: async () => ({ paused: false, maxAuthority: "deliver" }), act: () => assert.fail("Outer code must not write feedback") }, policy: {} });
    service.resolveRelease = async () => ({ version: "1.0.0", sha: c, runId: "123", channel: "runtime" });
    service.gh = async () => JSON.stringify({ head_sha: c });
    const result = await service.reconcile(file);
    assert.equal(result.state, "release-verified");
    assert.deepEqual(result.reports, batch.reports);
    assert.equal(JSON.parse(await readFile(file, "utf8")).state, "release-verified");
    service.gh = async () => JSON.stringify({ head_sha: a });
    await assert.rejects(service.reconcile(file), /different master/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test("FB-15 repair approval alone cannot dispatch a release", () => {
  assert.throws(() => validateFeedbackBatch(batch, [b, c], reports.map((r) => ({ ...r, approval: { ...r.approval, authority: "repair" } }))), /changed/);
});
test("FB-13 release policy rejects credentials, agent instructions and out-of-scope paths", () => {
  validateFeedbackPaths(["src/widget.ts"], ["src/"]);
  for (const path of [".github/workflows/release.yml", "AGENTS.md", "src/package.json", "other/widget.ts", "../secrets"]) {
    assert.throws(() => validateFeedbackPaths([path], ["src/", ".github/", "AGENTS.md"]), /scope/);
  }
});
test("FB-10 two repairs share one immutable approved batch", () => {
  assert.match(validateFeedbackBatch(batch, [b, c], reports), /^[a-f0-9]{64}$/);
});
test("FB-10 unrelated master changes block automatic release", () => {
  assert.throws(() => validateFeedbackBatch(batch, [b, c, "d".repeat(40)], reports), /outside/);
});
test("FB-08/10 withdrawal and new evidence invalidate batch", () => {
  assert.throws(() => validateFeedbackBatch(batch, [b, c], [{ ...reports[0], status: "withdrawn" }, reports[1]]), /changed/);
  assert.throws(() => validateFeedbackBatch(batch, [b, c], [{ ...reports[0], inputVersion: 3 }, reports[1]]), /changed/);
});
