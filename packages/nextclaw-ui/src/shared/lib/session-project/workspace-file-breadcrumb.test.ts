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
        isCurrent: false,
      },
      {
        key: "0:src",
        label: "src",
        kind: "directory",
        isCurrent: false,
      },
      {
        key: "1:chat",
        label: "chat",
        kind: "directory",
        isCurrent: false,
      },
      {
        key: "2:example.tsx",
        label: "example.tsx",
        kind: "file",
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
        isCurrent: false,
      },
      {
        key: "0:tmp",
        label: "tmp",
        kind: "directory",
        isCurrent: false,
      },
      {
        key: "1:example.ts",
        label: "example.ts",
        kind: "file",
        isCurrent: true,
      },
    ]);
  });

  it("attaches line metadata for the workspace breadcrumb bar", () => {
    const breadcrumb = buildWorkspaceFileBreadcrumb({
      path: "README.md",
      sessionProjectRoot: "/Users/demo/project-alpha",
      line: 12,
      column: 4,
      truncated: true,
    });

    expect(breadcrumb.locationLabel).toBe("L12:4");
    expect(breadcrumb.truncated).toBe(true);
    expect(breadcrumb.segments[0]?.label).toBe("project-alpha");
    expect(breadcrumb.segments[1]?.label).toBe("README.md");
  });
});
