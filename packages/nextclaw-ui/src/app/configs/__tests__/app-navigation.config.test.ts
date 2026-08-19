import { describe, expect, it } from "vitest";
import {
  isMainWorkspaceRoute,
  resolveMobileRouteMeta,
} from "@/app/configs/app-navigation.config";

describe("panel app main navigation", () => {
  it("keeps panel app routes inside the main workspace shell", () => {
    expect(isMainWorkspaceRoute("/apps/panel/rust-todo")).toBe(true);
    expect(isMainWorkspaceRoute("/apps")).toBe(false);
  });

  it("provides mobile back navigation without adding a bottom-nav item", () => {
    const translate = (key: string) => key;
    expect(resolveMobileRouteMeta("/apps/panel/rust-todo", translate)).toEqual({
      title: "panelAppsTitle",
      backTarget: "/chat",
      backLabel: "chat",
    });
  });
});
