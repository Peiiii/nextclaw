import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateDirectoryBudget,
  inspectDirectoryBudgetExceptionText
} from "./maintainability-guard-directory-budget.mjs";

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
});

test("evaluateDirectoryBudget keeps warning when a touched over-limit directory has a complete exception", () => {
  const finding = evaluateDirectoryBudget({
    directoryPath: "packages/demo/src/services",
    currentCount: 12,
    previousCount: 11,
    exception: {
      readmePath: "packages/demo/src/services/README.md",
      found: true,
      missingFields: [],
      reason: "目录受装配边界约束，短期内需要保留扁平文件集合。"
    }
  });

  assert.equal(finding?.level, "warn");
  assert.match(finding?.message ?? "", /hard file-count budget/);
});
