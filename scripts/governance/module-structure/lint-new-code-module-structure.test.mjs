import assert from "node:assert/strict";
import test from "node:test";

import { findModuleStructureContract, isProtocolContract } from "./module-structure-contracts.mjs";
import {
  evaluateModuleStructureFindings,
  evaluateProtocolImportBoundaryFindings
} from "./lint-new-code-module-structure.mjs";

test("finds the protocol declaration for nextclaw-ui src", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/features/chat/index.ts");
  assert.equal(contract?.modulePath, "packages/nextclaw-ui/src");
  assert.equal(contract?.protocol, "frontend-l3");
  assert.equal(isProtocolContract(contract), true);
});

test("blocks a new root directory outside the L3 skeleton", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/runtime-control/runtime-control.manager.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/runtime-control/runtime-control.manager.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /outside the module structure whitelist/);
});

test("blocks a new file added under an existing legacy root directory", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/components/chat/new-toolbar.tsx");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/components/chat/new-toolbar.tsx",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: true
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /new file was added under legacy root directory/);
});

test("downgrades touched legacy files under old roots to warnings", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page.tsx");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page.tsx",
    contract,
    existedInComparisonRef: true,
    rootEntryExistedInComparisonRef: true
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "warn");
  assert.match(findings[0].message, /legacy root directory/);
});

test("blocks reserved role names under features", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/features/hooks/index.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/features/hooks/index.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false,
    repoPathExists: () => true
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /must use business directory names/);
});

test("blocks feature files outside index or role directories", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/features/chat/chat-page.tsx");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/features/chat/chat-page.tsx",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false,
    repoPathExists: () => true
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /may only expose 'index.ts' or 'index.tsx'/);
});

test("requires feature index entry when adding files under a feature role directory", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/features/chat/components/chat-panel.tsx");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/features/chat/components/chat-panel.tsx",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false,
    repoPathExists: (repoPath) => repoPath.endsWith("/components/chat-panel.tsx")
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /missing 'index\.ts' or 'index\.tsx'/);
});

test("blocks shared root barrel index files", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/shared/components/index.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/shared/components/index.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /forbids root-level 'index\.ts' or 'index\.tsx'/);
});

test("blocks direct files under shared lib root", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/shared/lib/date-format.utils.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/shared/lib/date-format.utils.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /files cannot live directly under 'shared\/lib\/'/);
});

test("requires platform index entry and role directories", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/platforms/desktop/chat/chat-bridge.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/platforms/desktop/chat/chat-bridge.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false,
    repoPathExists: () => false
  });

  assert.equal(findings.length, 2);
  assert.equal(findings[0].level, "error");
  assert.equal(findings[1].level, "error");
  assert.match(findings[0].message, /missing 'index\.ts' or 'index\.tsx'/);
  assert.match(findings[1].message, /may only contain role directories/);
});

test("blocks new deep imports into another feature", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/app.tsx");
  const findings = evaluateProtocolImportBoundaryFindings({
    filePath: "packages/nextclaw-ui/src/app.tsx",
    contract,
    source: `import { ChatPanel } from "@/features/chat/components/chat-panel";\n`,
    addedLines: new Set([1])
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /feature imports must go through 'features\/chat'/);
});

test("allows deep imports inside the same feature boundary", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/features/chat/components/chat-page.tsx");
  const findings = evaluateProtocolImportBoundaryFindings({
    filePath: "packages/nextclaw-ui/src/features/chat/components/chat-page.tsx",
    contract,
    source: `import { useChatStore } from "../stores/chat.store";\n`,
    addedLines: new Set([1])
  });

  assert.equal(findings.length, 0);
});

test("blocks new deep imports into shared lib internals", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/app.tsx");
  const findings = evaluateProtocolImportBoundaryFindings({
    filePath: "packages/nextclaw-ui/src/app.tsx",
    contract,
    source: `import { formatDate } from "@/shared/lib/date-format/date-format.utils";\n`,
    addedLines: new Set([1])
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /shared\/lib imports must go through 'shared\/lib\/date-format'/);
});

test("warns when a touched file still carries a legacy deep import", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/app.tsx");
  const findings = evaluateProtocolImportBoundaryFindings({
    filePath: "packages/nextclaw-ui/src/app.tsx",
    contract,
    source: `import { ChatPanel } from "@/features/chat/components/chat-panel";\n`,
    addedLines: new Set()
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "warn");
  assert.match(findings[0].message, /feature imports must go through 'features\/chat'/);
});

test("allows shared component file imports", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/app.tsx");
  const findings = evaluateProtocolImportBoundaryFindings({
    filePath: "packages/nextclaw-ui/src/app.tsx",
    contract,
    source: `import { Button } from "@/shared/components/button";\n`,
    addedLines: new Set([1])
  });

  assert.equal(findings.length, 0);
});
