import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { configureProviderCatalog, listProviderSpecs } from "@nextclaw/core";

describe("@nextclaw/runtime module boundary", () => {
  it("does not install builtin providers on import", async () => {
    configureProviderCatalog([]);

    const runtime = await import("./builtin-provider-registry.provider.js");

    assert.ok(runtime.builtinProviderIds().length > 0);
    assert.deepEqual(listProviderSpecs(), []);
  });

  it("installs builtin providers only when requested", async () => {
    configureProviderCatalog([]);

    const runtime = await import("./builtin-provider-registry.provider.js");
    runtime.installBuiltinProviderRegistry();

    assert.ok(listProviderSpecs().length > 0);
  });
});
