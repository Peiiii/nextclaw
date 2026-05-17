import assert from "node:assert/strict";
import test from "node:test";
import { computeRuntimeRestartDelayMs } from "../runtime-service";

test("caps automatic recovery backoff to a bounded delay", () => {
  assert.equal(computeRuntimeRestartDelayMs(1), 500);
  assert.equal(computeRuntimeRestartDelayMs(2), 1_000);
  assert.equal(computeRuntimeRestartDelayMs(3), 2_000);
  assert.equal(computeRuntimeRestartDelayMs(10), 15_000);
});
