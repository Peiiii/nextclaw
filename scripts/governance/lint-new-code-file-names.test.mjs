import assert from "node:assert/strict";
import test from "node:test";

import {
  collectFileNameKebabViolations,
  isBlockingFileNameEntry
} from "./lint-new-code-file-names.mjs";

test("blocks new files whose names are not kebab-case", () => {
  const violations = collectFileNameKebabViolations([
    {
      filePath: "packages/demo/src/NcpChatPage.tsx",
      status: "A"
    }
  ]);

  assert.equal(violations.length, 1);
  assert.equal(violations[0].level, "error");
  assert.match(violations[0].message, /new or renamed file name is not kebab-case/);
  assert.equal(violations[0].suggestedPath, "packages/demo/src/ncp-chat-page.tsx");
});

test("warns instead of blocking when a touched legacy file keeps a non-kebab name", () => {
  const violations = collectFileNameKebabViolations([
    {
      filePath: "packages/demo/src/useAgents.ts",
      status: "M"
    }
  ]);

  assert.equal(violations.length, 1);
  assert.equal(violations[0].level, "warn");
  assert.match(violations[0].message, /touched legacy file name is still not kebab-case/);
});

test("blocks touched legacy files when the path is under strict touched governance", () => {
  const entry = {
    filePath: "apps/platform-admin/src/pages/LoginPage.tsx",
    status: "M"
  };

  assert.equal(isBlockingFileNameEntry(entry), true);

  const violations = collectFileNameKebabViolations([entry]);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].level, "error");
  assert.match(violations[0].message, /strict touched-legacy governance/);
});

test("accepts already compliant file names", () => {
  const violations = collectFileNameKebabViolations([
    {
      filePath: "packages/demo/src/router.auth.test.ts",
      status: "A"
    }
  ]);

  assert.deepEqual(violations, []);
});
