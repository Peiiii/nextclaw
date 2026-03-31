import assert from "node:assert/strict";
import test from "node:test";

import { evaluateFlatDirectoryFinding, summarizeDirectoryTreeSignals } from "./lint-new-code-flat-directories.mjs";

test("marks a flat mixed-responsibility directory as needing a subtree", () => {
  const summary = summarizeDirectoryTreeSignals({
    directCodeFiles: [
      "packages/demo/src/chat/ChatPage.tsx",
      "packages/demo/src/chat/chat.service.ts",
      "packages/demo/src/chat/chat.store.ts",
      "packages/demo/src/chat/chat-adapter.ts",
      "packages/demo/src/chat/chat-runtime.ts",
      "packages/demo/src/chat/chat-controller.ts",
      "packages/demo/src/chat/chat-provider.ts",
      "packages/demo/src/chat/chat-panel.tsx"
    ],
    directSubdirectories: []
  });

  assert.equal(summary.needsSubtree, true);
});

test("returns an error when a touched directory grows into a flat mixed tree without exception", () => {
  const finding = evaluateFlatDirectoryFinding({
    directoryPath: "packages/demo/src/chat",
    currentShape: {
      directCodeFiles: [
        "packages/demo/src/chat/ChatPage.tsx",
        "packages/demo/src/chat/chat.service.ts",
        "packages/demo/src/chat/chat.store.ts",
        "packages/demo/src/chat/chat-adapter.ts",
        "packages/demo/src/chat/chat-runtime.ts",
        "packages/demo/src/chat/chat-controller.ts",
        "packages/demo/src/chat/chat-provider.ts",
        "packages/demo/src/chat/chat-panel.tsx"
      ],
      directSubdirectories: []
    },
    previousShape: {
      directCodeFiles: [
        "packages/demo/src/chat/ChatPage.tsx",
        "packages/demo/src/chat/chat.service.ts",
        "packages/demo/src/chat/chat.store.ts",
        "packages/demo/src/chat/chat-adapter.ts",
        "packages/demo/src/chat/chat-runtime.ts",
        "packages/demo/src/chat/chat-controller.ts",
        "packages/demo/src/chat/chat-panel.tsx"
      ],
      directSubdirectories: []
    },
    exception: {
      readmePath: "packages/demo/src/chat/README.md",
      found: false,
      missingFields: ["原因"],
      reason: null
    }
  });

  assert.equal(finding?.level, "error");
  assert.match(finding?.message ?? "", /flat mixed-responsibility directory/);
});

test("downgrades to warning when a subtree exception is recorded", () => {
  const finding = evaluateFlatDirectoryFinding({
    directoryPath: "packages/demo/src/chat",
    currentShape: {
      directCodeFiles: [
        "packages/demo/src/chat/ChatPage.tsx",
        "packages/demo/src/chat/chat.service.ts",
        "packages/demo/src/chat/chat.store.ts",
        "packages/demo/src/chat/chat-adapter.ts",
        "packages/demo/src/chat/chat-runtime.ts",
        "packages/demo/src/chat/chat-controller.ts",
        "packages/demo/src/chat/chat-provider.ts",
        "packages/demo/src/chat/chat-panel.tsx"
      ],
      directSubdirectories: []
    },
    previousShape: {
      directCodeFiles: [
        "packages/demo/src/chat/ChatPage.tsx",
        "packages/demo/src/chat/chat.service.ts",
        "packages/demo/src/chat/chat.store.ts",
        "packages/demo/src/chat/chat-adapter.ts",
        "packages/demo/src/chat/chat-runtime.ts",
        "packages/demo/src/chat/chat-controller.ts",
        "packages/demo/src/chat/chat-provider.ts",
        "packages/demo/src/chat/chat-panel.tsx"
      ],
      directSubdirectories: []
    },
    exception: {
      readmePath: "packages/demo/src/chat/README.md",
      found: true,
      missingFields: [],
      reason: "该目录受框架装配约束，短期需要保留扁平入口。"
    }
  });

  assert.equal(finding?.level, "warn");
});
