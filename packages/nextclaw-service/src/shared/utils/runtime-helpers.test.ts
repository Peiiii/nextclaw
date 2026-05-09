import { describe, expect, it } from "vitest";
import { resolveSkillsInstallWorkdir } from "./runtime-helpers.js";

describe("resolveSkillsInstallWorkdir", () => {
  it("uses explicit workdir when provided", () => {
    const result = resolveSkillsInstallWorkdir({
      explicitWorkdir: "/tmp/explicit-workspace",
      configuredWorkspace: "/tmp/config-workspace"
    });

    expect(result).toBe("/tmp/explicit-workspace");
  });

  it("falls back to configured workspace when explicit workdir is absent", () => {
    const result = resolveSkillsInstallWorkdir({
      configuredWorkspace: "/tmp/config-workspace"
    });

    expect(result).toBe("/tmp/config-workspace");
  });
});
