import assert from "node:assert/strict";
import test from "node:test";

const publicHarness = await import("@nextclaw/harness");
const kernel = await import("@nextclaw/kernel");

test("exports only the intentional runtime surface", () => {
  assert.deepEqual(Object.keys(publicHarness).sort(), [
    "Contribution",
    "EventBus",
    "Ingress",
    "NextclawHarness",
    "NextclawHarnessError",
    "createTypedKey",
    "eventKeys",
    "ingressKeys",
    "runNextclawTask",
  ]);
});

test("delegates runtime ownership to the kernel harness", () => {
  assert.equal(
    publicHarness.NextclawHarness,
    kernel.NextclawHarness,
  );
  assert.equal(publicHarness.Contribution, kernel.Contribution);
  assert.equal(publicHarness.runNextclawTask, kernel.runNextclawTask);
  assert.equal(publicHarness.EventBus, kernel.EventBus);
  assert.equal(publicHarness.Ingress, kernel.Ingress);
  assert.equal(publicHarness.eventKeys, kernel.eventKeys);
  assert.equal(publicHarness.ingressKeys, kernel.ingressKeys);
  assert.equal(
    publicHarness.NextclawHarnessError,
    kernel.NextclawHarnessError,
  );
});
