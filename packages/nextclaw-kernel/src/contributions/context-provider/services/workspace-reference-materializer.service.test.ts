import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CHAT_PROJECT_TOKEN_KIND,
  CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND,
  CHAT_WORKSPACE_EXCERPT_TOKEN_KIND,
  CHAT_WORKSPACE_FILE_TOKEN_KIND,
} from "@nextclaw/shared";
import { WorkspaceReferenceMaterializerService } from "./workspace-reference-materializer.service.js";

const tempDirectories: string[] = [];

function createTempDirectory(prefix: string): string {
  const path = mkdtempSync(join(tmpdir(), prefix));
  tempDirectories.push(path);
  return path;
}

afterEach(() => {
  while (tempDirectories.length > 0) {
    rmSync(tempDirectories.pop()!, { recursive: true, force: true });
  }
});

describe("WorkspaceReferenceMaterializerService", () => {
  it("embeds bounded text file content and a directory outline", async () => {
    const projectRoot = createTempDirectory("nextclaw-workspace-reference-");
    mkdirSync(join(projectRoot, "src"), { recursive: true });
    mkdirSync(join(projectRoot, "docs", "guide"), { recursive: true });
    mkdirSync(join(projectRoot, "docs", "node_modules", "ignored"), { recursive: true });
    writeFileSync(join(projectRoot, "src", "index.ts"), "export const answer = 42;\n");
    writeFileSync(join(projectRoot, "docs", "guide", "start.md"), "# Start\n");
    writeFileSync(join(projectRoot, "docs", "node_modules", "ignored", "deep.js"), "ignored");

    const context = await new WorkspaceReferenceMaterializerService().materialize({
      projectRoot,
      references: [
        {
          kind: CHAT_WORKSPACE_FILE_TOKEN_KIND,
          key: "src/index.ts",
          label: "index.ts",
        },
        {
          kind: CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND,
          key: "docs",
          label: "docs",
        },
      ],
    });

    expect(context).toContain('<workspace_file path="src/index.ts">');
    expect(context).toContain("export const answer = 42;");
    expect(context).toContain('<workspace_directory path="docs">');
    expect(context).toContain("guide/");
    expect(context).toContain("start.md");
    expect(context).toContain("node_modules/");
    expect(context).not.toContain("deep.js");
  });

  it("marks large text references as truncated", async () => {
    const projectRoot = createTempDirectory("nextclaw-workspace-reference-large-");
    writeFileSync(join(projectRoot, "large.txt"), "x".repeat(40_000));

    const context = await new WorkspaceReferenceMaterializerService().materialize({
      projectRoot,
      references: [{
        kind: CHAT_WORKSPACE_FILE_TOKEN_KIND,
        key: "large.txt",
        label: "large.txt",
      }],
    });

    expect(context).toContain('<workspace_file path="large.txt" truncated="true">');
    expect(context.length).toBeLessThan(34_000);
  });

  it("materializes the active project root from the stable dot reference", async () => {
    const projectRoot = createTempDirectory("nextclaw-workspace-reference-dot-");
    mkdirSync(join(projectRoot, "docs"), { recursive: true });
    writeFileSync(join(projectRoot, "README.md"), "# Root\n");

    const context = await new WorkspaceReferenceMaterializerService().materialize({
      projectRoot,
      references: [{
        kind: CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND,
        key: ".",
        label: "project root",
      }],
    });

    expect(context).toContain('<workspace_directory path=".">');
    expect(context).toContain("README.md");
    expect(context).toContain("docs/");
  });

  it("embeds only the immutable excerpt snapshot with its source location", async () => {
    const projectRoot = createTempDirectory("nextclaw-workspace-excerpt-");
    writeFileSync(join(projectRoot, "guide.md"), "whole file content that must not be embedded");

    const context = await new WorkspaceReferenceMaterializerService().materialize({
      projectRoot,
      references: [{
        kind: CHAT_WORKSPACE_EXCERPT_TOKEN_KIND,
        key: "guide.md#excerpt-1",
        path: "guide.md",
        label: "guide.md",
        excerpt: "selected snapshot",
        startLine: 12,
        endLine: 13,
      }],
    });

    expect(context).toContain('<workspace_excerpt path="guide.md" start_line="12" end_line="13">');
    expect(context).toContain("selected snapshot");
    expect(context).not.toContain("whole file content");
  });

  it("rejects references that resolve outside the active project", async () => {
    const projectRoot = createTempDirectory("nextclaw-workspace-reference-root-");
    const externalRoot = createTempDirectory("nextclaw-workspace-reference-external-");
    writeFileSync(join(externalRoot, "secret.txt"), "secret");
    symlinkSync(
      externalRoot,
      join(projectRoot, "external"),
      process.platform === "win32" ? "junction" : "dir",
    );

    const context = await new WorkspaceReferenceMaterializerService().materialize({
      projectRoot,
      references: [{
        kind: CHAT_WORKSPACE_FILE_TOKEN_KIND,
        key: "external/secret.txt",
        label: "secret.txt",
      }],
    });

    expect(context).toContain("rejected: resolved path is outside the active project");
    expect(context).not.toContain("secret\n");
  });

  it("materializes registered project metadata and a bounded root outline", async () => {
    const activeProjectRoot = createTempDirectory("nextclaw-workspace-reference-active-");
    const referencedProjectRoot = realpathSync(
      createTempDirectory("nextclaw-workspace-reference-project-"),
    );
    mkdirSync(join(referencedProjectRoot, "docs"), { recursive: true });
    writeFileSync(join(referencedProjectRoot, "README.md"), "# Referenced\n");
    writeFileSync(join(referencedProjectRoot, "docs", "guide.md"), "# Guide\n");

    const context = await new WorkspaceReferenceMaterializerService().materialize({
      projectRoot: activeProjectRoot,
      references: [{
        kind: CHAT_PROJECT_TOKEN_KIND,
        key: referencedProjectRoot,
        label: "Knowledge",
        project: {
          name: "Knowledge",
          rootPath: referencedProjectRoot,
        },
      }],
    });

    expect(context).toContain(
      `<project_reference name="Knowledge" root_path="${referencedProjectRoot}">`,
    );
    expect(context).toContain("docs/");
    expect(context).toContain("guide.md");
    expect(context).toContain("README.md");
  });

  it("reports unregistered project references without reading their path", async () => {
    const activeProjectRoot = createTempDirectory("nextclaw-workspace-reference-active-");
    const unregisteredProjectRoot = createTempDirectory("nextclaw-workspace-reference-unregistered-");
    writeFileSync(join(unregisteredProjectRoot, "secret.txt"), "secret");

    const context = await new WorkspaceReferenceMaterializerService().materialize({
      projectRoot: activeProjectRoot,
      references: [{
        kind: CHAT_PROJECT_TOKEN_KIND,
        key: unregisteredProjectRoot,
        label: "Unregistered",
        project: null,
      }],
    });

    expect(context).toContain("unavailable: project is not registered");
    expect(context).not.toContain("secret.txt");
  });
});
