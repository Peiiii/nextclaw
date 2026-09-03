import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectError, ProjectManager } from "@kernel/features/projects/index.js";

const tempDirs: string[] = [];

function createFixture() {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-project-manager-"));
  tempDirs.push(dir);
  const workspace = join(dir, "workspace");
  const legacyStorePath = join(dir, "home", "projects", "projects.json");
  const databasePath = join(dir, "home", "projects", "work-items.db");
  return {
    manager: new ProjectManager({
      databasePath,
      legacyStorePath,
      getDefaultWorkspacePath: () => workspace,
    }),
    databasePath,
    legacyStorePath,
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

  it("removes a project without deleting its directory and restores the same id only when explicitly added", async () => {
    const fixture = createFixture();
    const rootPath = join(fixture.workspace, "existing");
    await mkdir(rootPath, { recursive: true });
    await writeFile(join(rootPath, "keep.txt"), "keep", "utf8");
    const project = await fixture.manager.addExistingProject(rootPath);

    await expect(fixture.manager.removeProject(project!.id, "wrong-id")).rejects.toMatchObject({
      code: "PROJECT_REMOVE_CONFIRMATION_MISMATCH",
    });
    await expect(fixture.manager.removeProject(project!.id, project!.id)).resolves.toEqual(project);
    await expect(fixture.manager.listProjects()).resolves.toEqual([]);
    await expect(readdir(rootPath)).resolves.toEqual(["keep.txt"]);

    await fixture.manager.importSessionProjects([rootPath]);
    await expect(fixture.manager.listProjects()).resolves.toEqual([]);

    const restored = await fixture.manager.addExistingProject(rootPath);
    expect(restored).toMatchObject({
      id: project!.id,
      rootPath: project!.rootPath,
    });
    await expect(fixture.manager.listProjects()).resolves.toEqual([restored]);
  });

  it("returns a not-found error when removing an inactive project", async () => {
    const fixture = createFixture();

    await expect(fixture.manager.removeProject("missing", "missing")).rejects.toMatchObject({ code: "PROJECT_NOT_FOUND" });
  });
});

describe("ProjectManager legacy migration", () => {
  it("migrates historical project records by preserving their data and adding stable ids", async () => {
    const fixture = createFixture();
    const rootPath = join(fixture.workspace, "historical");
    await mkdir(rootPath, { recursive: true });
    await mkdir(join(fixture.legacyStorePath, ".."), { recursive: true });
    const legacySource = JSON.stringify({
      version: 1,
      projects: [{
        name: "Historical",
        rootPath: await realpath(rootPath),
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-02T00:00:00.000Z",
      },],
    });
    await writeFile(fixture.legacyStorePath, legacySource, "utf8");

    const [project] = await fixture.manager.listProjects();
    expect(project).toMatchObject({
      name: "Historical",
      rootPath: await realpath(rootPath),
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z",
    });
    expect(project?.id).toMatch(/^[A-Za-z0-9_-]{12}$/);
    await expect(fixture.manager.getProjectById(project!.id)).resolves.toEqual(project);
    await expect(readFile(fixture.legacyStorePath, "utf8")).resolves.toBe(legacySource);

    fixture.manager.dispose();
    await writeFile(fixture.legacyStorePath, "{ignored-after-migration", "utf8");
    const reopened = new ProjectManager({
      databasePath: fixture.databasePath,
      legacyStorePath: fixture.legacyStorePath,
      getDefaultWorkspacePath: () => fixture.workspace,
    });
    await expect(reopened.listProjects()).resolves.toEqual([project]);
    reopened.dispose();
  });

  it("migrates the previous stable registry without changing project ids", async () => {
    const fixture = createFixture();
    await mkdir(join(fixture.legacyStorePath, ".."), { recursive: true });
    await writeFile(
      fixture.legacyStorePath,
      JSON.stringify({
        version: 2,
        projects: [
          {
            id: "project-stable",
            name: "Stable",
            rootPath: join(fixture.workspace, "stable"),
            createdAt: "2026-07-01T00:00:00.000Z",
            updatedAt: "2026-07-02T00:00:00.000Z",
          },
        ],
      }),
      "utf8",
    );

    await expect(fixture.manager.listProjects()).resolves.toMatchObject([{ id: "project-stable", name: "Stable" }]);
  });

  it("preserves removed projects from the stable JSON registry", async () => {
    const fixture = createFixture();
    const rootPath = join(fixture.workspace, "removed");
    await mkdir(join(fixture.legacyStorePath, ".."), { recursive: true });
    await mkdir(rootPath, { recursive: true });
    await writeFile(
      fixture.legacyStorePath,
      JSON.stringify({
        version: 3,
        projects: [],
        removedProjects: [
          {
            id: "project-removed",
            name: "Removed",
            rootPath: await realpath(rootPath),
            createdAt: "2026-07-01T00:00:00.000Z",
            updatedAt: "2026-07-02T00:00:00.000Z",
          },
        ],
      }),
      "utf8",
    );

    await expect(fixture.manager.listProjects()).resolves.toEqual([]);
    await fixture.manager.importSessionProjects([rootPath]);
    await expect(fixture.manager.listProjects()).resolves.toEqual([]);
    const restored = await fixture.manager.addExistingProject(rootPath);
    expect(restored).toMatchObject({ id: "project-removed" });
  });

  it("serializes concurrent first reads through one SQLite migration", async () => {
    const fixture = createFixture();
    const rootPath = join(fixture.workspace, "concurrent");
    await mkdir(join(fixture.legacyStorePath, ".."), { recursive: true });
    await writeFile(
      fixture.legacyStorePath,
      JSON.stringify({
        version: 2,
        projects: [
          {
            id: "project-concurrent",
            name: "Concurrent",
            rootPath,
            createdAt: "2026-07-01T00:00:00.000Z",
            updatedAt: "2026-07-02T00:00:00.000Z",
          },
        ],
      }),
      "utf8",
    );

    const results = await Promise.all([
      fixture.manager.listProjects(),
      fixture.manager.listProjects(),
      fixture.manager.initialize().then(() => fixture.manager.listProjects()),
    ]);
    expect(results).toEqual([
      [expect.objectContaining({ id: "project-concurrent" })],
      [expect.objectContaining({ id: "project-concurrent" })],
      [expect.objectContaining({ id: "project-concurrent" })],
    ]);
  });
});

describe("ProjectManager boundaries", () => {
  it("rejects invalid project path types at the owner boundary", async () => {
    const fixture = createFixture();

    await expect(
      fixture.manager.createProject({
        name: "Invalid",
        rootPath: 42,
      } as never),
    ).rejects.toMatchObject({ code: "PROJECT_PATH_INVALID_TYPE" });
  });

  it("collapses the default workspace instead of registering it", async () => {
    const fixture = createFixture();
    await mkdir(fixture.workspace, { recursive: true });

    await expect(fixture.manager.normalizeSessionProjectRoot(fixture.workspace)).resolves.toBeNull();
    await expect(fixture.manager.listProjects()).resolves.toEqual([]);
    await expect(
      fixture.manager.createProject({
        name: "Workspace",
        rootPath: fixture.workspace,
      }),
    ).rejects.toBeInstanceOf(ProjectError);
  });

  it("surfaces a corrupted registry instead of overwriting it", async () => {
    const fixture = createFixture();
    await mkdir(join(fixture.legacyStorePath, ".."), { recursive: true });
    await writeFile(fixture.legacyStorePath, "{broken", "utf8");

    await expect(fixture.manager.listProjects()).rejects.toThrow(
      "project registry contains invalid JSON"
    );
    expect(await readFile(fixture.legacyStorePath, "utf8")).toBe("{broken");

    fixture.manager.dispose();
    await writeFile(
      fixture.legacyStorePath,
      JSON.stringify({ version: 2, projects: [] }),
      "utf8",
    );
    const recovered = new ProjectManager({
      databasePath: fixture.databasePath,
      legacyStorePath: fixture.legacyStorePath,
      getDefaultWorkspacePath: () => fixture.workspace,
    });
    await expect(recovered.listProjects()).resolves.toEqual([]);
    recovered.dispose();
  });
});
