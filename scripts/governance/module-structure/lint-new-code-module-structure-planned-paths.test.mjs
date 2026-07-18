import assert from "node:assert/strict";
import test from "node:test";

import { runPlannedModuleStructureCheck } from "./lint-new-code-module-structure.mjs";

test("planned module preflight blocks paths under a contract-only legacy root", () => {
  const report = runPlannedModuleStructureCheck([
    "apps/platform-admin/src/api/new-platform-api.provider.ts"
  ]);

  assert.equal(report.mode, "planned");
  assert.equal(report.violations.length, 1);
  assert.match(report.violations[0].message, /legacy root directory 'api\/'/);
});

test("planned module preflight accepts feature-local and shared paths", () => {
  const report = runPlannedModuleStructureCheck([
    "apps/platform-admin/src/features/admin-users/providers/admin-user-api.provider.ts",
    "apps/platform-admin/src/shared/components/data-table.tsx"
  ]);

  assert.deepEqual(report.violations, []);
});
