import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FeedbackWorker, runFeedbackCommand } from "../src/services/feedback-worker.service.mjs";

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "feedback-dispatch-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const report = { id: "test", inputVersion: 1, approval: { inputVersion: 1, reviewedAt: "first" } };
  let calls = 0;
  const client = { scan: async () => ({ approved: [report], unfinished: [] }),
    act: () => { throw new Error("The scanner must never write business state"); } };
  const options = { client, directory, execute: async () => { calls++; }, checkMs: 5 };
  return { worker: new FeedbackWorker(options), options, report, client, calls: () => calls };
}
test("empty or paused scans invoke no model and write no business state", async (t) => {
  const f = await fixture(t);
  f.client.scan = async () => ({ approved: [], unfinished: [] });
  for (let n = 0; n < 3; n++) assert.equal((await f.worker.tick()).state, "idle");
  f.client.scan = async () => ({ paused: true, approved: [f.report] });
  assert.equal((await f.worker.tick()).state, "idle"); assert.equal(f.calls(), 0);
});
test("same approval is reminded only once, including after restart", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.worker.tick()).state, "agent-exited");
  assert.equal((await new FeedbackWorker(f.options).tick()).state, "idle");
  assert.equal(f.calls(), 1);
  f.report.approval.reviewedAt = "new-admin-review";
  assert.equal((await f.worker.tick()).state, "agent-exited"); assert.equal(f.calls(), 2);
});
test("failed launch is recorded and not automatically retried", async (t) => {
  const f = await fixture(t); f.worker.execute = async () => { throw new Error("failed"); };
  assert.equal((await f.worker.tick()).state, "agent-failed");
  assert.equal((await new FeedbackWorker(f.options).tick()).state, "idle");
});
test("parallel processes share an exclusive dispatch intent", async (t) => {
  const f = await fixture(t);
  await Promise.all([f.worker.tick(), new FeedbackWorker(f.options).tick()]);
  assert.equal(f.calls(), 1);
});
test("revocation cancels the process without writing a fabricated result", async (t) => {
  const f = await fixture(t);
  f.worker.execute = async (_, signal) => {
    f.client.scan = async () => ({ approved: [], unfinished: [] });
    await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
  };
  assert.equal((await f.worker.tick()).state, "agent-failed");
});
test("subprocess input is data and nonzero exits fail", async () => {
  const input = "$(do-not-execute)";
  assert.equal(await runFeedbackCommand([process.execPath, "-e", "process.stdin.pipe(process.stdout)"], { cwd: process.cwd(), input }), input);
  await assert.rejects(runFeedbackCommand([process.execPath, "-e", "process.exit(2)"], { cwd: process.cwd() }));
});
