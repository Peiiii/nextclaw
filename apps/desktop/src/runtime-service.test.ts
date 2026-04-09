import assert from "node:assert/strict";
import test from "node:test";
import { resolveManagedUiBaseUrlFromState } from "./runtime-service";

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
