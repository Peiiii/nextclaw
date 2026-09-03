import { describe, expect, it } from "vitest";
import { getProjectWorkStateLabel } from "./project-work-state-label.utils";

describe("getProjectWorkStateLabel", () => {
  it.each([
    ["Backlog", "待整理"],
    ["Planned", "已计划"],
    ["In Progress", "进行中"],
    ["In Review", "评审中"],
    ["Awaiting Acceptance", "等待验收"],
    ["Completed", "已完成"],
    ["Canceled", "已取消"],
  ])("localizes the built-in %s state", (name, expected) => {
    expect(getProjectWorkStateLabel(name, "zh")).toBe(expected);
  });

  it("keeps custom state names unchanged", () => {
    expect(getProjectWorkStateLabel("Ready to publish", "zh")).toBe(
      "Ready to publish",
    );
  });

  it("keeps the built-in English labels in English", () => {
    expect(getProjectWorkStateLabel("Awaiting Acceptance", "en")).toBe(
      "Awaiting Acceptance",
    );
  });
});
