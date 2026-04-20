import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  collectDirectoryBudgetHotspots,
  evaluateDirectoryBudget,
  inspectDirectoryBudgetExceptionText
} from "./maintainability-directory-budget.mjs";
import { isProtocolFlatRoleDirectory } from "./module-structure/module-structure-flat-role-directories.mjs";

function withTempRoot(run) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nextclaw-directory-budget-"));
  try {
    return run(tempRoot);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function writeFile(filePath, content = "export const fixture = true;\n") {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writeCodeFiles(directoryPath, count, extension = ".ts") {
  for (let index = 0; index < count; index += 1) {
    writeFile(path.join(directoryPath, `file-${index + 1}${extension}`));
  }
}

test("inspectDirectoryBudgetExceptionText reads a complete exception block", () => {
  const coverage = inspectDirectoryBudgetExceptionText(`
# Example

## 目录预算豁免
- 原因：该目录受框架约束，必须保留扁平 page 文件集合。
`);

  assert.equal(coverage.found, true);
  assert.deepEqual(coverage.missingFields, []);
  assert.equal(coverage.reason, "该目录受框架约束，必须保留扁平 page 文件集合。");
});

test("inspectDirectoryBudgetExceptionText reports missing reason", () => {
  const coverage = inspectDirectoryBudgetExceptionText(`
## 目录预算豁免
- 备注：只有目录，没有原因。
`);

  assert.equal(coverage.found, true);
  assert.deepEqual(coverage.missingFields, ["原因"]);
  assert.equal(coverage.reason, null);
});

test("evaluateDirectoryBudget blocks a directory that reaches the hard limit without an exception", () => {
  const finding = evaluateDirectoryBudget({
    directoryPath: "packages/demo/src/components",
    currentCount: 12,
    previousCount: 11,
    exception: {
      readmePath: "packages/demo/src/components/README.md",
      found: false,
      missingFields: ["原因"],
      reason: null
    }
  });

  assert.equal(finding?.level, "error");
  assert.match(finding?.message ?? "", /hard file-count limit/);
});

test("evaluateDirectoryBudget downgrades to warn when a complete exception is recorded", () => {
  const finding = evaluateDirectoryBudget({
    directoryPath: "packages/demo/src/pages",
    currentCount: 12,
    previousCount: 11,
    exception: {
      readmePath: "packages/demo/src/pages/README.md",
      found: true,
      missingFields: [],
      reason: "目录由框架路由约束，保留扁平页面文件结构。"
    }
  });

  assert.equal(finding?.level, "warn");
  assert.equal(finding?.exception_reason, "目录由框架路由约束，保留扁平页面文件结构。");
  assert.equal(finding?.scope, "diff");
});

test("protocol flat role directories are exempt from directory budget escalation", () => {
  assert.equal(isProtocolFlatRoleDirectory("packages/nextclaw-kernel/src/services"), true);

  const finding = evaluateDirectoryBudget({
    directoryPath: "packages/nextclaw-kernel/src/services",
    currentCount: 16,
    previousCount: 11,
    exception: {
      readmePath: "packages/nextclaw-kernel/src/services/README.md",
      found: false,
      missingFields: ["原因"],
      reason: null
    }
  });

  assert.equal(finding, null);
});

test("collectDirectoryBudgetHotspots reports real hotspots and ignores generated directories", () => {
  withTempRoot((rootDir) => {
    writeCodeFiles(path.join(rootDir, "packages/demo/src/components"), 12, ".ts");
    writeCodeFiles(path.join(rootDir, "packages/demo/src/pages"), 12, ".tsx");
    writeFile(
      path.join(rootDir, "packages/demo/src/pages/README.md"),
      "## 目录预算豁免\n- 原因：该目录受文件系统路由约束，必须保留扁平页面文件集合。\n"
    );
    writeCodeFiles(path.join(rootDir, "packages/demo/ui-dist/assets"), 29, ".js");
    writeCodeFiles(path.join(rootDir, "scripts/tools"), 12, ".mjs");

    const report = collectDirectoryBudgetHotspots({
      rootDir,
      scanRoots: ["packages/demo", "scripts"]
    });

    assert.deepEqual(report.scannedRoots, ["packages/demo", "scripts"]);
    assert.equal(report.countsByLevel.error, 2);
    assert.equal(report.countsByLevel.warn, 1);
    assert.equal(
      report.hotspots.some((entry) => entry.path === "packages/demo/ui-dist/assets"),
      false
    );
    assert.equal(
      report.hotspots.some((entry) => entry.path === "packages/demo/src/components" && entry.level === "error"),
      true
    );
    assert.equal(
      report.hotspots.some((entry) => entry.path === "packages/demo/src/pages" && entry.exception_status === "complete"),
      true
    );
    assert.equal(
      report.hotspots.some((entry) => entry.path === "scripts/tools" && entry.level === "warn"),
      false
    );
    assert.equal(
      report.hotspots.some((entry) => entry.path === "scripts/tools" && entry.level === "error"),
      true
    );
  });
});
