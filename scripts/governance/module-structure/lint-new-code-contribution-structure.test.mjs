import assert from "node:assert/strict";
import test from "node:test";

import { findModuleStructureContract } from "./module-structure-contracts.mjs";
import {
  evaluateModuleStructureFindings,
  evaluateProtocolImportBoundaryFindings
} from "./lint-new-code-module-structure.mjs";

test("allows contribution root index files as contribution boundary entries", () => {
  const contract = findModuleStructureContract("packages/nextclaw-kernel/src/contributions/session-activity-preview/index.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-kernel/src/contributions/session-activity-preview/index.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false
  });

  assert.equal(findings.length, 0);
});

test("blocks contribution files outside index or role directories", () => {
  const contract = findModuleStructureContract("packages/nextclaw-kernel/src/contributions/session-activity-preview/session-activity-preview.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-kernel/src/contributions/session-activity-preview/session-activity-preview.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false,
    repoPathExists: () => true
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /may only expose 'index\.ts' or 'index\.tsx'/);
});

test("requires contribution index entry when adding files under a contribution role directory", () => {
  const contract = findModuleStructureContract("packages/nextclaw-kernel/src/contributions/session-activity-preview/utils/session-activity-preview.utils.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-kernel/src/contributions/session-activity-preview/utils/session-activity-preview.utils.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false,
    repoPathExists: (repoPath) => repoPath.endsWith("/utils/session-activity-preview.utils.ts")
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /missing 'index\.ts' or 'index\.tsx'/);
});

test("blocks nested directories under flat role dirs inside contributions", () => {
  const contract = findModuleStructureContract("packages/nextclaw-kernel/src/contributions/session-activity-preview/utils/events/session-activity-preview-event.utils.ts");
  const findings = evaluateModuleStructureFindings({
    filePath: "packages/nextclaw-kernel/src/contributions/session-activity-preview/utils/events/session-activity-preview-event.utils.ts",
    contract,
    existedInComparisonRef: false,
    rootEntryExistedInComparisonRef: false,
    repoPathExists: () => true
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /may only contain direct files/);
});

test("blocks new deep imports into contribution internals", () => {
  const contract = findModuleStructureContract("packages/nextclaw-kernel/src/app/nextclaw-kernel.ts");
  const findings = evaluateProtocolImportBoundaryFindings({
    filePath: "packages/nextclaw-kernel/src/app/nextclaw-kernel.ts",
    contract,
    source: `import { createPreview } from "@kernel/contributions/session-activity-preview/utils/session-activity-preview.utils";\n`,
    addedLines: new Set([1])
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "error");
  assert.match(findings[0].message, /contribution imports must go through 'contributions\/session-activity-preview'/);
});
