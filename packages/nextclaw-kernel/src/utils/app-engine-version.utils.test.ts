import { describe, expect, it } from "vitest";
import { satisfiesAppEngineVersion } from "@kernel/utils/app-engine-version.utils.js";

describe("satisfiesAppEngineVersion", () => {
  it("supports the common semver range forms used by app manifests", () => {
    expect(satisfiesAppEngineVersion("0.31.0", ">=0.31.0")).toBe(true);
    expect(satisfiesAppEngineVersion("0.30.9", ">=0.31.0")).toBe(false);
    expect(satisfiesAppEngineVersion("0.31.8", ">=0.31.0 <0.32.0")).toBe(true);
    expect(satisfiesAppEngineVersion("1.4.2", "^1.2.0")).toBe(true);
    expect(satisfiesAppEngineVersion("2.0.0", "^1.2.0")).toBe(false);
    expect(satisfiesAppEngineVersion("0.31.5", "~0.31.0")).toBe(true);
    expect(satisfiesAppEngineVersion("0.32.0", "~0.31.0")).toBe(false);
    expect(satisfiesAppEngineVersion("0.31.4", "0.31.x")).toBe(true);
    expect(satisfiesAppEngineVersion("0.31.0-beta.1", ">=0.31.0")).toBe(false);
    expect(satisfiesAppEngineVersion("0.31.0", "0.30.0 || >=0.31.0")).toBe(true);
  });

  it("rejects invalid versions and ranges", () => {
    expect(satisfiesAppEngineVersion("development", ">=0.31.0")).toBe(false);
    expect(satisfiesAppEngineVersion("0.31.0", "")).toBe(false);
  });
});
