import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveArtifactReleaseScope,
  summarizePlannedReleaseScope
} from "./release-scope.mjs";

test("expands embedded artifact consumers into the release scope", () => {
  const { expandedPackageNames } = resolveArtifactReleaseScope(new Set(["@nextclaw/ui"]));

  assert.deepEqual([...expandedPackageNames].sort(), ["@nextclaw/ui", "nextclaw"]);
});

test("reports an incomplete artifact release closure", () => {
  assert.deepEqual(resolveArtifactReleaseScope(new Set(["@nextclaw/ui"])).failures, [
    {
      producerPackageName: "@nextclaw/ui",
      consumerPackageName: "nextclaw"
    }
  ]);
  assert.deepEqual(
    resolveArtifactReleaseScope(new Set(["@nextclaw/ui", "nextclaw"])).failures,
    []
  );
});

test("uses the canonical Changesets release closure instead of direct changeset seeds", () => {
  const summary = summarizePlannedReleaseScope({
    releases: [
      { name: "@nextclaw/core", newVersion: "0.16.1" },
      { name: "@nextclaw/runtime", newVersion: "0.4.26" },
      { name: "nextclaw", newVersion: "0.34.1" }
    ]
  });

  assert.equal(summary.npmPublishPackageCount, 3);
  assert.ok(summary.validationPackageCount >= summary.npmPublishPackageCount);
  assert.equal(
    summary.validationPackageCount,
    summary.npmPublishPackageCount + summary.validationSupportPackageCount
  );
});
