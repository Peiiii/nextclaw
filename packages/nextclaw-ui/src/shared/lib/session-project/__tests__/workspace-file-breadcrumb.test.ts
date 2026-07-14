import { describe, expect, it } from "vitest";
import { buildWorkspaceFileBreadcrumb } from "@/shared/lib/session-project";

describe("buildWorkspaceFileBreadcrumb", () => {
  it("builds project-relative breadcrumbs for files inside the active workspace", () => {
    const breadcrumb = buildWorkspaceFileBreadcrumb({
      path: "/Users/demo/project-alpha/src/chat/example.tsx",
      sessionProjectRoot: "/Users/demo/project-alpha",
      truncated: false,
    });

    expect(breadcrumb.segments).toEqual([
      {
        key: "workspace:project-alpha",
        label: "project-alpha",
        kind: "workspace",
        path: "/Users/demo/project-alpha",
        browsePath: "/Users/demo/project-alpha",
        isCurrent: false,
      },
      {
        key: "0:src",
        label: "src",
        kind: "directory",
        path: "/Users/demo/project-alpha/src",
        browsePath: "/Users/demo/project-alpha/src",
        isCurrent: false,
      },
      {
        key: "1:chat",
        label: "chat",
        kind: "directory",
        path: "/Users/demo/project-alpha/src/chat",
        browsePath: "/Users/demo/project-alpha/src/chat",
        isCurrent: false,
      },
      {
        key: "2:example.tsx",
        label: "example.tsx",
        kind: "file",
        path: "/Users/demo/project-alpha/src/chat/example.tsx",
        browsePath: "/Users/demo/project-alpha/src/chat",
        isCurrent: true,
      },
    ]);
  });

  it("keeps absolute path breadcrumbs when the file sits outside the workspace root", () => {
    const breadcrumb = buildWorkspaceFileBreadcrumb({
      path: "/tmp/example.ts",
      sessionProjectRoot: "/Users/demo/project-alpha",
      truncated: false,
    });

    expect(breadcrumb.segments).toEqual([
      {
        key: "root:/",
        label: "/",
        kind: "root",
        path: "/",
        browsePath: "/",
        isCurrent: false,
      },
      {
        key: "0:tmp",
        label: "tmp",
        kind: "directory",
        path: "/tmp",
        browsePath: "/tmp",
        isCurrent: false,
      },
      {
        key: "1:example.ts",
        label: "example.ts",
        kind: "file",
        path: "/tmp/example.ts",
        browsePath: "/tmp",
        isCurrent: true,
      },
    ]);
  });

  it("keeps truncation status separate from path segments", () => {
    const breadcrumb = buildWorkspaceFileBreadcrumb({
      path: "README.md",
      sessionProjectRoot: "/Users/demo/project-alpha",
      truncated: true,
    });

    expect(breadcrumb.truncated).toBe(true);
    expect(breadcrumb.segments[0]?.label).toBe("project-alpha");
    expect(breadcrumb.segments[1]?.label).toBe("README.md");
  });
});
