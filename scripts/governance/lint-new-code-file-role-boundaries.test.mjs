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

test("allows sitecustomize bridge entry files without role suffixes", () => {
  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/hermes-acp-route-bridge/sitecustomize.py",
    status: "M"
  }), null);
});

test("allows component files without role suffixes", () => {
  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/components/chat-shell.tsx",
    status: "A"
  }), null);
});

test("skips role-boundary enforcement for script support paths", () => {
  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: ".agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs",
    status: "M"
  }), null);

  assert.equal(inspectFileRoleBoundaryEntry({
    filePath: "apps/demo/scripts/smoke-test.sh",
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

test("blocks touched files when they still violate the directory mapping", () => {
  const violation = inspectFileRoleBoundaryEntry({
    filePath: "packages/demo/src/providers/openai.ts",
    status: "M"
  });

  assert.ok(violation);
  assert.equal(violation.level, "error");
  assert.match(violation.message, /touched file in 'providers\//);
});

test("blocks touched files outside page naming rules too", () => {
  const violation = inspectFileRoleBoundaryEntry({
    filePath: "apps/platform-admin/src/pages/LoginPage.tsx",
    status: "M"
  });

  assert.ok(violation);
  assert.equal(violation.level, "error");
  assert.match(violation.message, /touched file in 'pages\//);
});
