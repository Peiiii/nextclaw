import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createBaseScanConfig } from "./code-volume-metrics-profile.mjs";
import { collectDetailedSnapshot } from "./code-volume-metrics-snapshot.mjs";

const createFixtureRepo = () => mkdtempSync(join(tmpdir(), "nextclaw-code-volume-"));

test("source profile excludes vitepress roots", () => {
  const repoRoot = createFixtureRepo();
  mkdirSync(join(repoRoot, "apps", "site", "src"), { recursive: true });
  mkdirSync(join(repoRoot, "apps", "site", ".vitepress"), { recursive: true });
  writeFileSync(join(repoRoot, "package.json"), JSON.stringify({ workspaces: ["apps/*"] }), "utf8");
  writeFileSync(join(repoRoot, "apps", "site", "package.json"), JSON.stringify({ name: "site" }), "utf8");

  const config = createBaseScanConfig({ repoRoot, scopeProfile: "source" });

  assert.deepEqual(config.includePaths, ["apps/site/src"]);
});

test("snapshot reports production and test code separately", () => {
  const repoRoot = createFixtureRepo();
  mkdirSync(join(repoRoot, "src"), { recursive: true });
  writeFileSync(join(repoRoot, "src", "feature.ts"), "export const value = 1;\n", "utf8");
  writeFileSync(join(repoRoot, "src", "feature.test.ts"), "import './feature';\ntest('feature', () => {});\n", "utf8");

  const snapshot = collectDetailedSnapshot({
    repoRoot,
    scopeProfile: "source",
    includePaths: ["src"],
    includeExtensions: [".ts"],
    excludeDirs: [],
    gitSha: "",
    gitRef: "",
    generatedAt: "2026-05-10T00:00:00.000Z"
  });

  assert.equal(snapshot.totals.codeLines, 1);
  assert.equal(snapshot.totals.testCodeLines, 2);
  assert.equal(snapshot.byScope[0].testCodeLines, 2);
  assert.equal(snapshot.byFile[0].path, "src/feature.ts");
});
