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

test("blocks touched strict flat directories even when they are not newly growing", () => {
  const finding = evaluateFlatDirectoryFinding({
    directoryPath: "packages/nextclaw-ui/src/components/chat",
    currentShape: {
      directCodeFiles: [
        "packages/nextclaw-ui/src/components/chat/ChatPage.tsx",
        "packages/nextclaw-ui/src/components/chat/chat.service.ts",
        "packages/nextclaw-ui/src/components/chat/chat.store.ts",
        "packages/nextclaw-ui/src/components/chat/chat-adapter.ts",
        "packages/nextclaw-ui/src/components/chat/chat-runtime.ts",
        "packages/nextclaw-ui/src/components/chat/chat-controller.ts",
        "packages/nextclaw-ui/src/components/chat/chat-provider.ts",
        "packages/nextclaw-ui/src/components/chat/chat-panel.tsx"
      ],
      directSubdirectories: []
    },
    previousShape: {
      directCodeFiles: [
        "packages/nextclaw-ui/src/components/chat/ChatPage.tsx",
        "packages/nextclaw-ui/src/components/chat/chat.service.ts",
        "packages/nextclaw-ui/src/components/chat/chat.store.ts",
        "packages/nextclaw-ui/src/components/chat/chat-adapter.ts",
        "packages/nextclaw-ui/src/components/chat/chat-runtime.ts",
        "packages/nextclaw-ui/src/components/chat/chat-controller.ts",
        "packages/nextclaw-ui/src/components/chat/chat-provider.ts",
        "packages/nextclaw-ui/src/components/chat/chat-panel.tsx"
      ],
      directSubdirectories: []
    },
    exception: {
      readmePath: "packages/nextclaw-ui/src/components/chat/README.md",
      found: false,
      missingFields: ["原因"],
      reason: null
    }
  });

  assert.equal(finding?.level, "error");
  assert.match(finding?.message ?? "", /strict flat-directory governance/);
});

test("skips subtree enforcement for protocol flat role directories", () => {
  const finding = evaluateFlatDirectoryFinding({
    directoryPath: "packages/nextclaw-kernel/src/services",
    currentShape: {
      directCodeFiles: [
        "packages/nextclaw-kernel/src/services/agent.service.ts",
        "packages/nextclaw-kernel/src/services/runtime.service.ts",
        "packages/nextclaw-kernel/src/services/session.service.ts",
        "packages/nextclaw-kernel/src/services/provider.service.ts",
        "packages/nextclaw-kernel/src/services/model.service.ts",
        "packages/nextclaw-kernel/src/services/plugin.service.ts",
        "packages/nextclaw-kernel/src/services/skill.service.ts",
        "packages/nextclaw-kernel/src/services/context.service.ts"
      ],
      directSubdirectories: []
    },
    previousShape: {
      directCodeFiles: [
        "packages/nextclaw-kernel/src/services/agent.service.ts",
        "packages/nextclaw-kernel/src/services/runtime.service.ts",
        "packages/nextclaw-kernel/src/services/session.service.ts",
        "packages/nextclaw-kernel/src/services/provider.service.ts",
        "packages/nextclaw-kernel/src/services/model.service.ts",
        "packages/nextclaw-kernel/src/services/plugin.service.ts",
        "packages/nextclaw-kernel/src/services/skill.service.ts",
        "packages/nextclaw-kernel/src/services/context.service.ts"
      ],
      directSubdirectories: []
    },
    exception: {
      readmePath: "packages/nextclaw-kernel/src/services/README.md",
      found: false,
      missingFields: ["原因"],
      reason: null
    }
  });

  assert.equal(finding, null);
});
