import assert from "node:assert/strict";
import test from "node:test";

import { findModuleStructureContract } from "./module-structure-contracts.mjs";
import { evaluateModuleStructureFindings } from "./lint-new-code-module-structure.mjs";

test("finds the longest matching module contract", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page.tsx");
  assert.equal(contract?.modulePath, "packages/nextclaw-ui/src/components/chat");
});

test("blocks a new root file when the module root is frozen", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/components/chat/chat-draft-toolbar.tsx");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/components/chat/chat-draft-toolbar.tsx",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /module root is frozen/);
});

test("downgrades touched legacy root files to warnings", () => {
  const contract = findModuleStructureContract("packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx",
    contract,
    existedInComparisonRef: true,
    rootEntryExistedInComparisonRef: false
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "warn");
  assert.match(findings[0].message, /legacy root file/);
});

test("blocks a new directory outside the contract whitelist", () => {
  const contract = findModuleStructureContract("apps/platform-console/src/runtime/runtime-shell.tsx");
  const findings = evaluateModuleStructureFindings({
    filePath: "apps/platform-console/src/runtime/runtime-shell.tsx",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /outside the module structure whitelist/);
});

test("blocks orchestration-shaped files inside shared containers", () => {
  const contract = findModuleStructureContract("workers/nextclaw-provider-gateway-api/src/utils/auth-flow.service.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "workers/nextclaw-provider-gateway-api/src/utils/auth-flow.service.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: true
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /shared container/);
});

test("allows whitelisted root files for contract-only app roots", () => {
  const contract = findModuleStructureContract("apps/platform-admin/src/App.tsx");
  const findings = evaluateModuleStructureFindings({
    filePath: "apps/platform-admin/src/App.tsx",
    contract,
    existedInComparisonRef: true,
    rootEntryExistedInComparisonRef: false
  });

  assert.equal(findings.length, 0);
});
