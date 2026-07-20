import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectError, ProjectManager } from "@kernel/managers/project.manager.js";

const tempDirs: string[] = [];

function createFixture() {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-project-manager-"));
  tempDirs.push(dir);
  const workspace = join(dir, "workspace");
  const storePath = join(dir, "home", "projects", "projects.json");
  return {
    manager: new ProjectManager({
      storePath,
      getDefaultWorkspacePath: () => workspace,
    }),
    storePath,
    workspace,
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("ProjectManager", () => {
  it("creates and restores an empty project without a session", async () => {
    const fixture = createFixture();

    const project = await fixture.manager.createProject({ name: "Research" });

    expect(project).toMatchObject({
      name: "Research",
      rootPath: await realpath(join(fixture.workspace, "Research")),
      template: "empty",
    });
    expect(await readdir(project.rootPath)).toEqual([]);
    await expect(fixture.manager.listProjects()).resolves.toEqual([project]);
  });

  it("materializes the knowledge-base template in an empty directory", async () => {
    const fixture = createFixture();
    const rootPath = join(fixture.workspace, "knowledge");
    await mkdir(rootPath, { recursive: true });

    const project = await fixture.manager.createProject({
      name: "Knowledge",
      rootPath,
      template: "knowledge-base",
    });

    expect((await readdir(rootPath)).sort()).toEqual(["README.md", "notes", "sources"]);
    expect(await readFile(join(rootPath, "README.md"), "utf8")).toContain("# Knowledge");
    expect(project.template).toBe("knowledge-base");
  });

  it("does not overwrite a non-empty directory", async () => {
    const fixture = createFixture();
    const rootPath = join(fixture.workspace, "existing");
    await mkdir(rootPath, { recursive: true });
    await writeFile(join(rootPath, "keep.txt"), "keep", "utf8");

    await expect(fixture.manager.createProject({ name: "Existing", rootPath }))
      .rejects.toMatchObject({ code: "PROJECT_PATH_NOT_EMPTY" });
    expect(await readFile(join(rootPath, "keep.txt"), "utf8")).toBe("keep");
  });

  it("registers an existing non-empty directory without initializing its contents", async () => {
    const fixture = createFixture();
    const rootPath = join(fixture.workspace, "existing");
    await mkdir(rootPath, { recursive: true });
    await writeFile(join(rootPath, "keep.txt"), "keep", "utf8");

    const project = await fixture.manager.registerExistingProject(rootPath);

    expect(project).toMatchObject({
      name: "existing",
      rootPath: await realpath(rootPath),
    });
    expect(project).not.toHaveProperty("template");
    expect(await readdir(rootPath)).toEqual(["keep.txt"]);
    expect(await readFile(join(rootPath, "keep.txt"), "utf8")).toBe("keep");
  });

  it("rejects invalid project path types at the owner boundary", async () => {
    const fixture = createFixture();

    await expect(fixture.manager.createProject({
      name: "Invalid",
      rootPath: 42,
    } as never)).rejects.toMatchObject({ code: "PROJECT_PATH_INVALID_TYPE" });
  });

  it("collapses the default workspace instead of registering it", async () => {
    const fixture = createFixture();
    await mkdir(fixture.workspace, { recursive: true });

    await expect(fixture.manager.normalizeSessionProjectRoot(fixture.workspace)).resolves.toBeNull();
    await expect(fixture.manager.listProjects()).resolves.toEqual([]);
    await expect(fixture.manager.createProject({
      name: "Workspace",
      rootPath: fixture.workspace,
    })).rejects.toBeInstanceOf(ProjectError);
  });

  it("surfaces a corrupted registry instead of overwriting it", async () => {
    const fixture = createFixture();
    await mkdir(join(fixture.storePath, ".."), { recursive: true });
    await writeFile(fixture.storePath, "{broken", "utf8");

    await expect(fixture.manager.listProjects()).rejects.toThrow(
      "project registry contains invalid JSON",
    );
    expect(await readFile(fixture.storePath, "utf8")).toBe("{broken");
  });
});
