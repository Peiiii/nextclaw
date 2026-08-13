import assert from "node:assert/strict";
import test from "node:test";
import { planReleaseCheckBatch } from "./batch-plan.mjs";
import { canRunPackageStep, createPackageStates, hydrateCachedSteps } from "./task-runner.mjs";

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

test("caches non-release workspace dependency builds outside the release package checkpoint", () => {
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
    checkpoint: { packages: {}, validationSupport: {} },
    dependencyMap: plan.dependencyMap,
    fingerprints: new Map([
      ["@nextclaw/foundation", "foundation"],
      ["nextclaw", "product"]
    ]),
    includeLint: true,
    orderedValidationPackages: plan.orderedValidationPackages,
    priorityScores: plan.priorityScores
  });
  assert.equal(states.get("@nextclaw/foundation").checkpointSection, "validationSupport");
  assert.deepEqual(
    states.get("@nextclaw/foundation").stepSpecs.map((step) => step.stepName),
    ["build"]
  );
  assert.equal(states.get("nextclaw").checkpointSection, "packages");
  assert.deepEqual(states.get("nextclaw").dependencyNames, ["@nextclaw/foundation"]);

  const checkpoint = {
    packages: {
      nextclaw: {
        version: "1.0.0",
        steps: {
          build: { status: "passed", command: "build", fingerprint: "product" }
        }
      }
    },
    validationSupport: {
      "@nextclaw/foundation": {
        version: "1.0.0",
        steps: {
          build: { status: "passed", command: "build", fingerprint: "foundation" }
        }
      }
    }
  };
  const cacheSummary = hydrateCachedSteps({ checkpoint, packageStates: states });
  assert.deepEqual(cacheSummary, { cachedPackageCount: 2, cachedStepCount: 2 });
  assert.equal(states.get("@nextclaw/foundation").completedStepNames.has("build"), true);
  assert.equal(states.get("nextclaw").completedStepNames.has("build"), true);
});

test("serializes build, typecheck, and lint steps within one package", () => {
  const packageState = {
    activeStepNames: new Set(["build"])
  };
  assert.equal(canRunPackageStep(packageState), false);
  packageState.activeStepNames.clear();
  assert.equal(canRunPackageStep(packageState), true);
});
