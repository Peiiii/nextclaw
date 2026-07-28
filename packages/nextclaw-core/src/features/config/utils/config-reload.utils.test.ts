import { describe, expect, it } from "vitest";
import { buildReloadPlan } from "./config-reload.utils.js";

describe("buildReloadPlan", () => {
  it("restarts channel runtime and refreshes agent behavior for channel config changes", () => {
    const plan = buildReloadPlan(["channels.feishu.enabled"]);
    expect(plan.restartChannels).toBe(true);
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

  it.each([
    "agents.runtimes.entries.codex.config.injectNextclawContext",
    "ui.ncp.runtimes.native.injectNextclawContext",
  ])("requires restart for agent runtime config changes at %s", (path) => {
    const plan = buildReloadPlan([path]);

    expect(plan.reloadAgent).toBe(false);
    expect(plan.restartRequired).toEqual([path]);
  });

  it("hot applies companion feature changes without requiring restart", () => {
    const plan = buildReloadPlan(["companion.enabled"]);
    expect(plan.reloadCompanion).toBe(true);
    expect(plan.restartRequired).toEqual([]);
  });
});
