import { describe, expect, it } from "vitest";
import {
  getMainSidebarNavItems,
  getMobileBottomNavItems,
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

describe("project home navigation", () => {
  const translate = (key: string) => key;

  it("keeps projects in the main workspace without a parallel global nav item", () => {
    expect(isMainWorkspaceRoute("/projects")).toBe(true);
    expect(getMainSidebarNavItems(translate).map((item) => item.target)).not.toContain("/projects");
    expect(getMobileBottomNavItems(translate).map((item) => item.target)).not.toContain("/projects");
  });

  it("returns mobile project pages to the chat project list", () => {
    expect(resolveMobileRouteMeta("/projects", translate)).toEqual({
      title: "projectsTitle",
      backTarget: "/chat",
      backLabel: "chat",
    });
  });
});
