import assert from "node:assert/strict";
import test from "node:test";

import { isGovernedWorkspaceFile } from "./lint-new-code-governance-support.mjs";

test("generated Panel App assets are not treated as workspace source", () => {
  assert.equal(isGovernedWorkspaceFile(
    "packages/nextclaw/resources/apps/personal-organizer/panels/todos.panel/assets/app.js",
  ), false);
  assert.equal(isGovernedWorkspaceFile(
    "apps/personal-organizer/src/features/todos/components/todo-list.tsx",
  ), true);
});
