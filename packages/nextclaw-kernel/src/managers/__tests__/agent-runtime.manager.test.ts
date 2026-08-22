import { describe, expect, it } from "vitest";
import { AgentRuntimeManager } from "@kernel/managers/agent-runtime.manager.js";

describe("AgentRuntimeManager contribution entries", () => {
  it("merges contributed entries with config entries and removes them", async () => {
    const manager = new AgentRuntimeManager();
    manager.applyEntries([
      { id: "configured", label: "Configured", type: "configured" },
    ]);
    const dispose = manager.registerEntry({
      id: "contributed",
      label: "Contributed",
      type: "contributed",
    });

    await expect(manager.listSessionTypes()).resolves.toMatchObject({
      options: expect.arrayContaining([
        expect.objectContaining({ value: "configured" }),
        expect.objectContaining({ value: "contributed" }),
      ]),
    });

    await dispose();
    const catalog = await manager.listSessionTypes();
    expect(catalog.options.some(({ value }) => value === "contributed")).toBe(
      false,
    );
  });

  it("rejects contributed entries that collide with configured identity", () => {
    const manager = new AgentRuntimeManager();
    manager.applyEntries([
      { id: "duplicate", label: "Configured", type: "configured" },
    ]);
    expect(() =>
      manager.registerEntry({
        id: "duplicate",
        label: "Contributed",
        type: "contributed",
      }),
    ).toThrow("already registered");
  });
});
