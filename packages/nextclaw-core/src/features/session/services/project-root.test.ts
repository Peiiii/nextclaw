import { describe, expect, it } from "vitest";
import { readSessionProjectRoot, resolveSessionWorkspacePath } from "./project-root.js";

describe("session project root helpers", () => {
  it("reads project_root from session metadata", () => {
    expect(
      readSessionProjectRoot({
        project_root: " /tmp/project-alpha ",
      }),
    ).toBe("/tmp/project-alpha");
  });

  it("prefers the session project root when resolving the effective workspace", () => {
    expect(
      resolveSessionWorkspacePath({
        sessionMetadata: {
          project_root: "/tmp/project-alpha",
        },
        workspace: "/tmp/default-workspace",
      }),
    ).toBe("/tmp/project-alpha");
  });
});
