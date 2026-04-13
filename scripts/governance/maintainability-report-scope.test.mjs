import assert from "node:assert/strict";
import test from "node:test";

import {
  findDeferredMaintainabilityWorkspace,
  isDeferredMaintainabilityWorkspace
} from "./maintainability-report-scope.mjs";

test("findDeferredMaintainabilityWorkspace matches an exact deferred workspace", () => {
  const entry = findDeferredMaintainabilityWorkspace("packages/extensions/nextclaw-channel-plugin-feishu");

  assert.equal(entry?.workspace, "packages/extensions/nextclaw-channel-plugin-feishu");
  assert.match(entry?.reason ?? "", /非核心渠道插件/);
});

test("findDeferredMaintainabilityWorkspace matches child paths under a deferred workspace", () => {
  const entry = findDeferredMaintainabilityWorkspace(
    "packages/extensions/nextclaw-channel-plugin-feishu/src/bot.ts"
  );

  assert.equal(entry?.workspace, "packages/extensions/nextclaw-channel-plugin-feishu");
  assert.equal(isDeferredMaintainabilityWorkspace("packages/extensions/nextclaw-channel-plugin-feishu/src"), true);
});

test("findDeferredMaintainabilityWorkspace ignores unrelated workspaces", () => {
  assert.equal(findDeferredMaintainabilityWorkspace("packages/nextclaw-core/src/agent"), null);
  assert.equal(isDeferredMaintainabilityWorkspace("packages/nextclaw-core"), false);
});
