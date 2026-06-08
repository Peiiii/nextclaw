import assert from "node:assert/strict";
import test from "node:test";

import {
  findDeferredMaintainabilityWorkspace,
  isDeferredMaintainabilityWorkspace
} from "./maintainability-report-scope.mjs";

test("findDeferredMaintainabilityWorkspace returns null when there are no deferred workspaces", () => {
  assert.equal(findDeferredMaintainabilityWorkspace("packages/nextclaw-core/src/agent"), null);
  assert.equal(isDeferredMaintainabilityWorkspace("packages/nextclaw-core"), false);
});
