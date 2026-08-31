import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventBus, eventKeys } from "@nextclaw/shared";
import {
  ProjectManager,
  ProjectWorkManager,
} from "@kernel/features/projects/index.js";

const tempDirs: string[] = [];

async function createFixture() {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-project-work-"));
  tempDirs.push(dir);
  const rootPath = join(dir, "project");
  await mkdir(rootPath, { recursive: true });
  const projectManager = new ProjectManager({
    storePath: join(dir, "data", "projects.json"),
    getDefaultWorkspacePath: () => join(dir, "workspace"),
  });
  const project = await projectManager.registerExistingProject(rootPath);
  if (!project) throw new Error("fixture project was not registered");
  const eventBus = new EventBus();
  const manager = new ProjectWorkManager({
    databasePath: join(dir, "data", "work-items.db"),
    eventBus,
    projectManager,
  });
  await manager.initialize();
  return { dir, eventBus, manager, project, projectManager, rootPath };
}

afterEach(() => {
  while (tempDirs.length > 0)
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe("ProjectWorkManager", () => {
  it("creates default states and persists work without touching the project directory", async () => {
    const fixture = await createFixture();
    const before = await readdir(fixture.rootPath);

    const item = await fixture.manager.create(
      fixture.project.id,
      { title: "Ship project work", description: "One durable owner" },
      { kind: "user", id: "desktop" },
    );
    fixture.manager.dispose();

    const reopened = new ProjectWorkManager({
      databasePath: join(fixture.dir, "data", "work-items.db"),
      eventBus: fixture.eventBus,
      projectManager: fixture.projectManager,
    });
    await reopened.initialize();
    const restored = await reopened.get(fixture.project.id, item.id);

    expect(restored).toMatchObject({ title: "Ship project work", version: 1 });
    expect(
      (await reopened.listStates(fixture.project.id)).map(
        (state) => state.name,
      ),
    ).toEqual([
      "Backlog",
      "Planned",
      "In Progress",
      "In Review",
      "Awaiting Acceptance",
      "Completed",
      "Canceled",
    ]);
    expect(await readdir(fixture.rootPath)).toEqual(before);
    reopened.dispose();
  });

  it("records repeated state transitions as immutable timeline activity", async () => {
    const fixture = await createFixture();
    const states = await fixture.manager.listStates(fixture.project.id);
    const progress = states.find((state) => state.name === "In Progress")!;
    const review = states.find((state) => state.name === "In Review")!;
    const item = await fixture.manager.create(
      fixture.project.id,
      { title: "Review loop" },
      { kind: "agent", sessionId: "s1" },
    );

    await fixture.manager.update(
      fixture.project.id,
      item.id,
      { stateId: progress.id },
      { kind: "agent", sessionId: "s1" },
    );
    await fixture.manager.update(
      fixture.project.id,
      item.id,
      { stateId: review.id },
      { kind: "agent", sessionId: "s1" },
    );
    await fixture.manager.update(
      fixture.project.id,
      item.id,
      { stateId: progress.id },
      { kind: "agent", sessionId: "s1" },
    );
    await fixture.manager.update(
      fixture.project.id,
      item.id,
      { stateId: review.id },
      { kind: "agent", sessionId: "s1" },
    );

    const page = await fixture.manager.listActivities(
      fixture.project.id,
      item.id,
    );
    expect(
      page.activities.filter((activity) => activity.type === "state-changed"),
    ).toHaveLength(4);
    expect(page.activities.at(-1)?.type).toBe("created");
    const firstPage = await fixture.manager.listActivities(
      fixture.project.id,
      item.id,
      { limit: 2 },
    );
    const secondPage = await fixture.manager.listActivities(
      fixture.project.id,
      item.id,
      { cursor: firstPage.nextCursor!, limit: 3 },
    );
    expect([...firstPage.activities, ...secondPage.activities]).toEqual(
      page.activities,
    );
    fixture.manager.dispose();
  });

  it("checks optimistic versions and publishes only committed mutations", async () => {
    const fixture = await createFixture();
    const changed = vi.fn();
    fixture.eventBus.on(eventKeys.projectWorkChanged, changed);
    const item = await fixture.manager.create(
      fixture.project.id,
      { title: "Versioned" },
      { kind: "user" },
    );

    await expect(
      fixture.manager.update(
        fixture.project.id,
        item.id,
        { title: "Stale", expectedVersion: 99 },
        { kind: "user" },
      ),
    ).rejects.toMatchObject({ code: "PROJECT_WORK_VERSION_CONFLICT" });

    expect(changed).toHaveBeenCalledTimes(1);
    expect((await fixture.manager.get(fixture.project.id, item.id)).title).toBe(
      "Versioned",
    );
    fixture.manager.dispose();
  });

  it("keeps no-op updates and duplicate artifact links idempotent", async () => {
    const fixture = await createFixture();
    await writeFile(join(fixture.rootPath, "design.md"), "design", "utf8");
    const changed = vi.fn();
    fixture.eventBus.on(eventKeys.projectWorkChanged, changed);
    const item = await fixture.manager.create(
      fixture.project.id,
      { title: "Idempotent" },
      { kind: "user" },
    );

    const unchanged = await fixture.manager.update(
      fixture.project.id,
      item.id,
      { title: item.title, expectedVersion: item.version },
      { kind: "user" },
    );
    const firstLink = await fixture.manager.linkArtifact({
      projectId: fixture.project.id,
      workItemId: item.id,
      path: "design.md",
      actor: { kind: "user" },
    });
    const duplicateLink = await fixture.manager.linkArtifact({
      projectId: fixture.project.id,
      workItemId: item.id,
      path: "design.md",
      actor: { kind: "user" },
    });

    expect(unchanged.version).toBe(item.version);
    expect(duplicateLink.id).toBe(firstLink.id);
    expect(
      (await fixture.manager.get(fixture.project.id, item.id)).artifacts,
    ).toHaveLength(1);
    expect(changed).toHaveBeenCalledTimes(2);
    fixture.manager.dispose();
  });

  it("links only existing files inside the project and can unlink them", async () => {
    const fixture = await createFixture();
    await writeFile(join(fixture.rootPath, "design.md"), "design", "utf8");
    await writeFile(join(fixture.dir, "outside.md"), "outside", "utf8");
    const item = await fixture.manager.create(
      fixture.project.id,
      { title: "Artifacts" },
      { kind: "user" },
    );

    const link = await fixture.manager.linkArtifact({
      projectId: fixture.project.id,
      workItemId: item.id,
      path: "design.md",
      label: "Design",
      actor: { kind: "user" },
    });
    expect(link).toMatchObject({ path: "design.md", label: "Design" });
    await expect(
      fixture.manager.linkArtifact({
        projectId: fixture.project.id,
        workItemId: item.id,
        path: join(fixture.dir, "outside.md"),
        actor: { kind: "user" },
      }),
    ).rejects.toMatchObject({ code: "PROJECT_WORK_ARTIFACT_INVALID" });
    await fixture.manager.unlinkArtifact({
      projectId: fixture.project.id,
      workItemId: item.id,
      artifactLinkId: link.id,
      actor: { kind: "user" },
    });
    expect(
      (await fixture.manager.get(fixture.project.id, item.id)).artifacts,
    ).toEqual([]);
    fixture.manager.dispose();
  });

  it("migrates items when deleting a custom state and preserves transition history", async () => {
    const fixture = await createFixture();
    const custom = await fixture.manager.createState(fixture.project.id, {
      name: "Needs changes",
      category: "started",
    });
    const completed = (
      await fixture.manager.listStates(fixture.project.id)
    ).find((state) => state.name === "Completed")!;
    const item = await fixture.manager.create(
      fixture.project.id,
      { title: "Migrate", stateId: custom.id },
      { kind: "user" },
    );

    await fixture.manager.deleteState(
      fixture.project.id,
      custom.id,
      completed.id,
      { kind: "user" },
    );

    expect(
      (await fixture.manager.get(fixture.project.id, item.id)).stateId,
    ).toBe(completed.id);
    expect(
      (await fixture.manager.listActivities(fixture.project.id, item.id))
        .activities[0],
    ).toMatchObject({
      type: "state-changed",
      details: { reason: "state-deleted" },
    });
    fixture.manager.dispose();
  });
});
