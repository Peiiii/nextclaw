import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function assertWorkflowNodeVersions(entry, source) {
  const setupNodeCount = source.match(/uses:\s*actions\/setup-node@/g)?.length ?? 0;
  if (setupNodeCount === 0) return;
  const versionFileCount = source.match(/node-version-file:\s*(?:publisher\/)?\.nvmrc/g)?.length ?? 0;
  const explicitVersionCount = source.match(/^\s*node-version:/gm)?.length ?? 0;
  if (entry === "release.yml") {
    assert.equal(versionFileCount + explicitVersionCount, setupNodeCount);
    assert.equal(explicitVersionCount, 1, "release.yml may vary Node only in the unsupported-version guard");
    assert.match(source, /name: Verify launcher version guard[\s\S]*--expect-unsupported/);
    return;
  }
  if (entry === "npm-install-compatibility.yml") {
    assert.equal(explicitVersionCount, 4);
    for (const expected of ["20.19.0", "22.19.0", "24", "26"]) assert.ok(source.includes(`node-version: "${expected}"`));
    assert.match(source, /--expected-version "\$EXPECTED_VERSION"/);
    return;
  }
  if (["desktop-release-preflight.yml", "desktop-release.yml"].includes(entry)) {
    assert.equal((source.match(/node-version: \$\{\{ inputs\.node_version \}\}/g) ?? []).length, setupNodeCount);
    assert.match(source, /node_version:[\s\S]*?Pinned Node version from the release protocol[\s\S]*?required: true/);
    return;
  }
  if (entry === "windows-update-smoke.yml") {
    assert.equal(versionFileCount, 1);
    assert.equal(explicitVersionCount, 1);
    assert.match(source, /session-journal-repro:[\s\S]*?node-version: 24\.18\.1[\s\S]*?gh release download v0\.59\.1-desktop\.1/);
    return;
  }
  assert.equal(versionFileCount, setupNodeCount, `${entry} must use .nvmrc for every setup-node step`);
  assert.equal(explicitVersionCount, 0, `${entry} must not declare a second Node version`);
}

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
    assertWorkflowNodeVersions(entry, source);
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
