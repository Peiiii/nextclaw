import test from "node:test";
import assert from "node:assert/strict";

import { extractChangedIterationReadmes } from "./maintainability-guard-hotspots.mjs";

test("extractChangedIterationReadmes keeps an explicitly provided iteration README", () => {
  const readmes = extractChangedIterationReadmes({
    candidatePaths: ["docs/logs/v0.14.102-guard-readme-detection/README.md"],
    statusOutput: "",
    fileExists: (pathText) => pathText === "docs/logs/v0.14.102-guard-readme-detection/README.md"
  });

  assert.deepEqual(readmes, ["docs/logs/v0.14.102-guard-readme-detection/README.md"]);
});

test("extractChangedIterationReadmes expands an untracked iteration directory to its README", () => {
  const readmes = extractChangedIterationReadmes({
    statusOutput: "?? docs/logs/v0.14.102-guard-readme-detection/\n",
    fileExists: (pathText) => pathText === "docs/logs/v0.14.102-guard-readme-detection/README.md"
  });

  assert.deepEqual(readmes, ["docs/logs/v0.14.102-guard-readme-detection/README.md"]);
});

test("extractChangedIterationReadmes ignores non-iteration paths", () => {
  const readmes = extractChangedIterationReadmes({
    candidatePaths: ["docs/logs/not-a-versioned-dir/README.md"],
    statusOutput: "?? docs/logs/not-a-versioned-dir/\n M packages/nextclaw/src/cli/commands/diagnostics.ts\n",
    fileExists: () => true
  });

  assert.deepEqual(readmes, []);
});
