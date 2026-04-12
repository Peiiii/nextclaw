import assert from "node:assert/strict";
import test from "node:test";
import { computeRuntimeRestartDelayMs, formatRuntimeCommandFailureMessage } from "./runtime-service";

test("includes recent cli output in runtime command failure message", () => {
  assert.equal(
    formatRuntimeCommandFailureMessage({
      label: "start",
      code: 1,
      signal: null,
      outputLines: [
        "Error: Cannot start nextclaw because UI port 55667 is already occupied.",
        "Health probe: http://127.0.0.1:55667/api/health is already healthy."
      ]
    }),
    [
      "Runtime command failed: start exited with code=1, signal=null",
      "Error: Cannot start nextclaw because UI port 55667 is already occupied.",
      "Health probe: http://127.0.0.1:55667/api/health is already healthy."
    ].join("\n")
  );
});

test("caps automatic recovery backoff to a bounded delay", () => {
  assert.equal(computeRuntimeRestartDelayMs(1), 500);
  assert.equal(computeRuntimeRestartDelayMs(2), 1_000);
  assert.equal(computeRuntimeRestartDelayMs(3), 2_000);
  assert.equal(computeRuntimeRestartDelayMs(10), 15_000);
});
