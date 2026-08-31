import assert from "node:assert/strict";
import test from "node:test";

import { cleanupPublishedInstallRoot } from "./published-npm-node-compatibility-cleanup.utils.mjs";

test("keeps a successful published package contract when Windows cleanup is briefly locked", () => {
  const warnings = [];
  assert.equal(
    cleanupPublishedInstallRoot({
      installRoot: "fixture",
      platform: "win32",
      remove: () => {
        const error = new Error("busy");
        error.code = "EBUSY";
        throw error;
      },
      warn: (message) => warnings.push(message),
    }),
    false,
  );
  assert.match(warnings[0], /Windows runner/);
});

test("does not hide a non-transient cleanup failure", () => {
  assert.throws(
    () => cleanupPublishedInstallRoot({
      installRoot: "fixture",
      platform: "linux",
      remove: () => {
        const error = new Error("permission denied");
        error.code = "EACCES";
        throw error;
      },
      warn: () => {},
    }),
    /permission denied/,
  );
});

test("keeps bounded cleanup on platforms where it cannot block a Windows runner", () => {
  const calls = [];
  assert.equal(
    cleanupPublishedInstallRoot({
      installRoot: "fixture",
      platform: "linux",
      remove: (...args) => calls.push(args),
      warn: () => {},
    }),
    true,
  );
  assert.deepEqual(calls, [["fixture", {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 500,
  }]]);
});
