import assert from "node:assert/strict";
import test from "node:test";
import { planReleaseCheckBatch } from "./batch-plan.mjs";
import { createPackageStates, hydrateCachedSteps } from "./task-runner.mjs";

function workspaceEntry(name, dependencies = {}, scripts = { build: "build", tsc: "tsc" }) {
  return {
    packageDir: `packages/${name.replaceAll("/", "-")}`,
    pkg: {
      name,
      version: "1.0.0",
      dependencies,
      scripts
    }
  };
}

test("builds non-release workspace dependencies without adding them to the release checkpoint", () => {
  const foundation = workspaceEntry("@nextclaw/foundation");
  const product = workspaceEntry("nextclaw", {
    "@nextclaw/foundation": "workspace:*"
  });
  const plan = planReleaseCheckBatch([product], [foundation, product]);

  assert.deepEqual(plan.orderedBatchPackages.map((entry) => entry.pkg.name), ["nextclaw"]);
  assert.deepEqual(plan.supportPackages.map((entry) => entry.pkg.name), ["@nextclaw/foundation"]);
  assert.deepEqual(plan.orderedValidationPackages.map((entry) => entry.pkg.name), [
    "@nextclaw/foundation",
    "nextclaw"
  ]);

  const states = createPackageStates({
    batchPackageNames: plan.batchPackageNames,
    checkpoint: { packages: {} },
    dependencyMap: plan.dependencyMap,
    fingerprints: new Map([
      ["@nextclaw/foundation", "foundation"],
      ["nextclaw", "product"]
    ]),
    includeLint: true,
    orderedValidationPackages: plan.orderedValidationPackages,
    priorityScores: plan.priorityScores
  });
  assert.equal(states.get("@nextclaw/foundation").checkpointed, false);
  assert.deepEqual(
    states.get("@nextclaw/foundation").stepSpecs.map((step) => step.stepName),
    ["build"]
  );
  assert.equal(states.get("nextclaw").checkpointed, true);
  assert.deepEqual(states.get("nextclaw").dependencyNames, ["@nextclaw/foundation"]);

  const checkpoint = {
    packages: {
      "@nextclaw/foundation": {
        version: "1.0.0",
        steps: {
          build: { status: "passed", command: "build", fingerprint: "foundation" }
        }
      },
      nextclaw: {
        version: "1.0.0",
        steps: {
          build: { status: "passed", command: "build", fingerprint: "product" }
        }
      }
    }
  };
  hydrateCachedSteps({ checkpoint, packageStates: states });
  assert.equal(states.get("@nextclaw/foundation").completedStepNames.has("build"), false);
  assert.equal(states.get("nextclaw").completedStepNames.has("build"), true);
});
