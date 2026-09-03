import { describe, expect, it } from "vitest";
import { isProjectHomeTab } from "./project-home.presenter";

describe("project home presenter", () => {
  it("accepts only the project home tabs represented in the route", () => {
    expect(isProjectHomeTab("overview")).toBe(true);
    expect(isProjectHomeTab("agreement")).toBe(true);
    expect(isProjectHomeTab("missing")).toBe(false);
    expect(isProjectHomeTab(undefined)).toBe(false);
  });
});
