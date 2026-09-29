import { describe, expect, it, vi } from "vitest";
import { ConfigSchema } from "../configs/config-schema.config.js";
import { resolveConfiguredAgentProfiles } from "./agent-profile-resolution.utils.js";

describe("platform-independent agent profile resolution", () => {
  it("uses the platform only for implicit homes and preserves runtime settings", () => {
    const config = ConfigSchema.parse({});
    config.agents.list = [
      { id: "explicit", default: false, workspace: "/chosen", engine: "custom", engineConfig: { mode: "test" } },
      { id: "implicit", default: false },
    ];
    const resolveHome = vi.fn((_config, id) => `/persistent/${id}`);
    const profiles = resolveConfiguredAgentProfiles(config, resolveHome);
    expect(resolveHome).toHaveBeenCalledTimes(1);
    expect(resolveHome).toHaveBeenCalledWith(config, "implicit");
    expect(profiles.find((profile) => profile.id === "explicit")).toMatchObject({
      workspace: "/chosen", runtime: "custom", runtimeConfig: { mode: "test" },
    });
    expect(profiles.find((profile) => profile.id === "implicit")?.workspace).toBe("/persistent/implicit");
  });

  it("resolves the main agent without probing an OS environment", () => {
    const config = ConfigSchema.parse({});
    config.agents.defaults.workspace = "/account/files";
    const resolveHome = vi.fn(() => { throw new Error("unexpected OS access"); });
    expect(resolveConfiguredAgentProfiles(config, resolveHome)[0]).toMatchObject({
      id: "main", workspace: "/account/files", default: true, builtIn: true,
    });
    expect(resolveHome).not.toHaveBeenCalled();
  });
});
