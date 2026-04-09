import assert from "node:assert/strict";
import test from "node:test";
import { formatRuntimeCommandFailureMessage, resolveManagedUiBaseUrlFromState } from "./runtime-service";

test("uses uiUrl when managed service state omits uiHost and uiPort", () => {
  assert.equal(
    resolveManagedUiBaseUrlFromState({
      uiUrl: "http://127.0.0.1:55667"
    }),
    "http://127.0.0.1:55667"
  );
});

test("falls back to uiHost and uiPort when uiUrl is invalid", () => {
  assert.equal(
    resolveManagedUiBaseUrlFromState({
      uiUrl: "not-a-url",
      uiHost: "0.0.0.0",
      uiPort: 18792
    }),
    "http://127.0.0.1:18792"
  );
});

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
