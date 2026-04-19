import { describe, expect, it } from "vitest";
import { parseConfigPath, setAtConfigPath } from "../../shared/utils/config-path.js";

describe("setAtConfigPath", () => {
  it("allows contiguous array writes", () => {
    const root: Record<string, unknown> = {};

    setAtConfigPath(root, parseConfigPath("agents.list[0].id"), "main");
    setAtConfigPath(root, parseConfigPath("agents.list[1].id"), "engineer");

    expect(root).toEqual({
      agents: {
        list: [
          { id: "main" },
          { id: "engineer" }
        ]
      }
    });
  });

  it("rejects sparse array writes", () => {
    const root: Record<string, unknown> = {};

    expect(() => setAtConfigPath(root, parseConfigPath("agents.list[3].id"), "researcher"))
      .toThrowError('Cannot set sparse array index 3 under "agents.list". Set indices in order.');
    expect(root).toEqual({
      agents: {
        list: []
      }
    });
  });
});
