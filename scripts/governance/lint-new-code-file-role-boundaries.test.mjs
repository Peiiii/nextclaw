import assert from "node:assert/strict";
import test from "node:test";

import {
  collectFileRoleBoundaryViolations,
  inspectFileRoleBoundaryEntry
} from "./lint-new-code-file-role-boundaries.mjs";

test("blocks new files in role directories when the suffix does not match the directory", () => {
  const violations = collectFileRoleBoundaryViolations([
    {
      filePath: "packages/demo/src/services/chat-manager.ts",
      status: "A"
    }
  ]);

  assert.equal(violations.length, 1);
  assert.equal(violations[0].level, "error");
  assert.match(violations[0].message, /services\/' must match '\*\.service\.ts'/);
});

test("allows test files whose underlying role still matches the directory", () => {
  const violation = inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/services/chat.service.contract.test.ts",
    status: "A"
  });

  assert.equal(violation, null);
});

test("blocks new non-component files outside exempt directories when they do not use a role suffix", () => {
  const violation = inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/features/chat/session-cache.ts",
    status: "A"
  });

  assert.ok(violation);
  assert.equal(violation.level, "error");
  assert.match(violation.message, /must use an approved secondary suffix/);
});

test("allows root entry files without role suffixes", () => {
  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "apps/demo/src/main.tsx",
    status: "A"
  }), null);

  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/app.ts",
    status: "A"
  }), null);
});

test("allows component files without role suffixes", () => {
  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/components/chat-shell.tsx",
    status: "A"
  }), null);
});

test("requires use-* naming inside hooks directories", () => {
  const violation = inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/hooks/chat-session.ts",
    status: "A"
  });

  assert.ok(violation);
  assert.match(violation.message, /hooks\/' must match 'use-<domain>\.ts\(x\)'/);
});

test("requires -page naming inside pages directories", () => {
  const violation = inspectFileRoleBoundaryEntry({
    filePath: "apps/demo/src/pages/chat.tsx",
    status: "A"
  });

  assert.ok(violation);
  assert.match(violation.message, /pages\/' must match '<domain>-page\.tsx'/);
});

test("warns instead of blocking when a touched legacy file still violates the directory mapping", () => {
  const violation = inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/providers/openai.ts",
    status: "M"
  });

  assert.ok(violation);
  assert.equal(violation.level, "warn");
  assert.match(violation.message, /touched legacy file in 'providers\//);
});

test("blocks touched legacy file-role violations inside strict touched governance", () => {
  const violation = inspectFileRoleBoundaryEntry({
    filePath: "apps/platform-admin/src/pages/LoginPage.tsx",
    status: "M"
  });

  assert.ok(violation);
  assert.equal(violation.level, "error");
  assert.match(violation.message, /strict touched-legacy governance/);
});
