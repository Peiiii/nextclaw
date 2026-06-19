import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACE_PATH } from "@core/features/config/index.js";
import {
  readSessionProjectRoot,
  resolveSessionProjectContext,
  resolveSessionWorkspacePath,
} from "./session-project-context.service.js";

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

  it("treats the default workspace symbol as the configured workspace, not a project override", () => {
    expect(
      resolveSessionWorkspacePath({
        sessionMetadata: {
          project_root: DEFAULT_WORKSPACE_PATH,
        },
        workspace: "/tmp/default-workspace",
      }),
    ).toBe("/tmp/default-workspace");
  });

  it("does not keep a project override when it equals the resolved workspace", () => {
    expect(
      resolveSessionProjectContext({
        sessionMetadata: {
          project_root: "/tmp/default-workspace",
        },
        workspace: "/tmp/default-workspace",
      }),
    ).toMatchObject({
      effectiveWorkspace: "/tmp/default-workspace",
      projectRoot: null,
      projectBootstrapRoot: null,
      projectSkillsRoot: null,
    });
  });
});
