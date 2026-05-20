import { describe, expect, it } from "vitest";
import { buildReloadPlan } from "./reload.js";

describe("buildReloadPlan", () => {
  it("does not force channel restart for non-channel plugin changes", () => {
    const plan = buildReloadPlan(["plugins.entries.provider-only-plugin.enabled"]);
    expect(plan.reloadPlugins).toBe(true);
    expect(plan.restartChannels).toBe(false);
  });

  it("restarts channel runtime without reloading plugins for channel config changes", () => {
    const plan = buildReloadPlan(["channels.feishu.enabled"]);
    expect(plan.restartChannels).toBe(true);
    expect(plan.reloadPlugins).toBe(false);
    expect(plan.reloadAgent).toBe(true);
    expect(plan.restartRequired).toEqual([]);
  });

  it("reloads MCP changes without marking restart required", () => {
    const plan = buildReloadPlan(["mcp.servers.chrome-devtools.enabled"]);
    expect(plan.reloadMcp).toBe(true);
    expect(plan.restartRequired).toEqual([]);
  });

  it("reloads agent runtime for learning loop config changes", () => {
    const plan = buildReloadPlan(["agents.learningLoop.enabled"]);
    expect(plan.reloadAgent).toBe(true);
    expect(plan.restartRequired).toEqual([]);
  });

  it("hot applies companion feature changes without requiring restart", () => {
    const plan = buildReloadPlan(["companion.enabled"]);
    expect(plan.reloadCompanion).toBe(true);
    expect(plan.restartRequired).toEqual([]);
  });
});
