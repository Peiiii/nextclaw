import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectKebabFilePath,
  suggestKebabFilePath,
  toKebabSegment
} from "./file-name-kebab-shared.mjs";

test("accepts kebab-case file names with dot-separated responsibility segments", () => {
  assert.equal(inspectKebabFilePath("packages/demo/src/router.auth.test.ts"), null);
  assert.equal(inspectKebabFilePath("packages/demo/eslint.config.mjs"), null);
});

test("reports camelCase and PascalCase file names", () => {
  assert.deepEqual(inspectKebabFilePath("packages/demo/src/useAgents.ts"), {
    filePath: "packages/demo/src/useAgents.ts",
    baseName: "useAgents.ts",
    invalidSegment: "useAgents",
    suggestedPath: "packages/demo/src/use-agents.ts",
    reason: "file name segment 'useAgents' is not kebab-case"
  });

  assert.deepEqual(inspectKebabFilePath("packages/demo/src/NcpChatPage.tsx"), {
    filePath: "packages/demo/src/NcpChatPage.tsx",
    baseName: "NcpChatPage.tsx",
    invalidSegment: "NcpChatPage",
    suggestedPath: "packages/demo/src/ncp-chat-page.tsx",
    reason: "file name segment 'NcpChatPage' is not kebab-case"
  });
});

test("normalizes mixed separators into kebab-case suggestions", () => {
  assert.equal(toKebabSegment("remote_quota_DO"), "remote-quota-do");
  assert.equal(
    suggestKebabFilePath("workers/demo/src/RemoteQuotaDO.test.ts"),
    "workers/demo/src/remote-quota-do.test.ts"
  );
});
