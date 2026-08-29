import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

test("keeps development and CI exact without narrowing the published CLI runtime", () => {
  const version = readFileSync(resolve(root, ".nvmrc"), "utf8").trim();
  assert.match(version, /^\d+\.\d+\.\d+$/);

  const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  assert.equal(packageJson.engines.node, version);
  const publishedPackage = JSON.parse(
    readFileSync(resolve(root, "packages/nextclaw/package.json"), "utf8"),
  );
  assert.equal(publishedPackage.engines.node, "^20.19.0 || >=22.12.0");
  assert.match(packageJson.scripts["dev:worktree"], /run-with-project-node\.sh/);

  const workflowDirectory = resolve(root, ".github/workflows");
  for (const entry of readdirSync(workflowDirectory)) {
    if (!/\.ya?ml$/.test(entry)) continue;
    const source = readFileSync(resolve(workflowDirectory, entry), "utf8");
    const setupNodeCount = source.match(/uses:\s*actions\/setup-node@/g)?.length ?? 0;
    if (setupNodeCount === 0) continue;
    const versionFileCount = source.match(/node-version-file:\s*\.nvmrc/g)?.length ?? 0;
    const explicitVersionCount = source.match(/^\s*node-version:/gm)?.length ?? 0;
    if (entry === "release.yml") {
      assert.equal(versionFileCount + explicitVersionCount, setupNodeCount);
      assert.equal(explicitVersionCount, 2, "release.yml may vary Node only in compatibility jobs");
      assert.match(source, /name: Setup compatibility Node[\s\S]*node-version: \$\{\{ matrix\.node \}\}/);
      assert.match(source, /name: Verify launcher version guard[\s\S]*--expect-unsupported/);
      continue;
    }
    assert.equal(versionFileCount, setupNodeCount, `${entry} must use .nvmrc for every setup-node step`);
    assert.equal(explicitVersionCount, 0, `${entry} must not declare a second Node version`);
  }

  const wrapper = resolve(root, "scripts/dev/node/run-with-project-node.sh");
  assert.notEqual(statSync(wrapper).mode & 0o111, 0, "project Node wrapper must be executable");

  const worktreeCreator = readFileSync(
    resolve(root, "scripts/dev/worktrees/create-parallel-worktree.mjs"),
    "utf8",
  );
  assert.match(worktreeCreator, /run\("corepack", \["pnpm", \.\.\.plan\.bootstrap\]/);
  assert.doesNotMatch(worktreeCreator, /run\("pnpm", plan\.bootstrap/);
});
