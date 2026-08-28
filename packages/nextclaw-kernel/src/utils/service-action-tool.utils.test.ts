import { describe, expect, it } from "vitest";
import { buildServiceActionToolName } from "./service-action-tool.utils.js";

describe("buildServiceActionToolName", () => {
  it("builds a stable OpenAI-compatible name", () => {
    const name = buildServiceActionToolName("portable-state.counter_read");
    expect(name).toMatch(/^service__[a-z0-9_]+__[a-f0-9]{8}$/);
    expect(name).toHaveLength(46);
    expect(buildServiceActionToolName("portable-state.counter_read")).toBe(name);
  });

  it("keeps long names within the provider limit and disambiguates normalized collisions", () => {
    const longName = buildServiceActionToolName(`${"very-long-service-".repeat(8)}.run`);
    expect(longName.length).toBeLessThanOrEqual(64);
    expect(buildServiceActionToolName("service-a.run-task"))
      .not.toBe(buildServiceActionToolName("service-a.run_task"));
  });
});
