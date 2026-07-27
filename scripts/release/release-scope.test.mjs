import assert from "node:assert/strict";
import test from "node:test";

import { resolveArtifactReleaseScope } from "./release-scope.mjs";

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
