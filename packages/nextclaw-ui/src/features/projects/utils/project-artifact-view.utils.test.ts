import { describe, expect, it } from "vitest";
import {
  formatProjectRelativeTime,
  joinProjectPath,
} from "./project-artifact-view.utils";

describe("project artifact view", () => {
  it("renders recent timestamps in people-friendly language", () => {
    const now = new Date("2026-08-30T12:00:00.000Z");
    expect(formatProjectRelativeTime("2026-08-30T11:57:00.000Z", now)).toBe(
      "3 minutes ago",
    );
    expect(formatProjectRelativeTime("2026-08-30T09:00:00.000Z", now)).toBe(
      "3 hours ago",
    );
    expect(formatProjectRelativeTime("2026-08-29T12:00:00.000Z", now)).toBe(
      "Yesterday",
    );
  });

  it("joins project-relative artifact paths across host path styles", () => {
    expect(joinProjectPath("/tmp/project", "docs/design.md")).toBe(
      "/tmp/project/docs/design.md",
    );
    expect(joinProjectPath("C:\\project\\", "docs/design.md")).toBe(
      "C:\\project\\docs/design.md",
    );
  });
});
