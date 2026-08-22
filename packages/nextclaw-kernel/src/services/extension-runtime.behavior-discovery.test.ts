import { describe, expect, it } from "vitest";
import { ExtensionManifestDiscoveryService } from "@kernel/features/extension-runtime/index.js";
import { createTempDir, writeExtensionManifest } from "./extension-runtime.test-fixtures.js";

describe("ExtensionRuntimeService", () => {
  it("deduplicates extension manifests by id across discovery roots", async () => {
    const rootA = createTempDir();
    const rootB = createTempDir();
    writeExtensionManifest(rootA);
    writeExtensionManifest(rootB);

    const manifests = await new ExtensionManifestDiscoveryService().discover([
      rootA,
      rootB,
    ]);

    expect(manifests.map((manifest) => manifest.id)).toEqual([
      "fake-extension",
    ]);
  });
});
