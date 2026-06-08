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

test("blocks touched files whose names are still not kebab-case", () => {
  const violations = collectFileNameKebabViolations([
    {
      filePath: "packages/demo/src/useAgents.ts",
      status: "M"
    }
  ]);

  assert.equal(violations.length, 1);
  assert.equal(violations[0].level, "error");
  assert.match(violations[0].message, /touched file name is not kebab-case/);
});

test("treats any touched invalid file name as blocking debt", () => {
  const entry = {
    filePath: "apps/platform-admin/src/pages/LoginPage.tsx",
    status: "M"
  };

  assert.equal(isBlockingFileNameEntry(entry), true);

  const violations = collectFileNameKebabViolations([entry]);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].level, "error");
  assert.match(violations[0].message, /touched file name is not kebab-case/);
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
