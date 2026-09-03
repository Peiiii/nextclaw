import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProjectMaterialService,
  type ProjectRecord,
} from "@kernel/features/projects/index.js";

const temporaryRoots: string[] = [];

async function createProjectRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "nextclaw-project-material-"));
  temporaryRoots.push(root);
  return root;
}

function project(rootPath: string): ProjectRecord {
  return {
    id: "project-1",
    name: "Sample Project",
    rootPath,
    createdAt: "2026-09-04T00:00:00.000Z",
    updatedAt: "2026-09-04T00:00:00.000Z",
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("ProjectMaterialService", () => {
  it("reads only the root AGENTS.md agreement", async () => {
    const rootPath = await createProjectRoot();
    const record = project(rootPath);
    const service = new ProjectMaterialService({
      projectManager: {
        getProjectById: vi.fn(async () => record),
      },
    });

    await expect(service.getAgreement(record.id)).resolves.toEqual({
      path: "AGENTS.md",
      available: false,
    });
    await writeFile(join(rootPath, "AGENTS.md"), "# Rules\n", "utf8");
    await expect(service.getAgreement(record.id)).resolves.toEqual({
      path: "AGENTS.md",
      available: true,
    });
  });

  it("loads project skills only from the fixed .agents/skills directory", async () => {
    const rootPath = await createProjectRoot();
    const record = project(rootPath);
    await mkdir(join(rootPath, ".agents", "skills", "alpha"), {
      recursive: true,
    });
    await mkdir(join(rootPath, "custom-skills", "ignored"), {
      recursive: true,
    });
    await writeFile(
      join(rootPath, ".agents", "skills", "alpha", "SKILL.md"),
      "---\nname: alpha\ndescription: Alpha project skill\n---\n# Alpha\n",
      "utf8",
    );
    await writeFile(
      join(rootPath, "custom-skills", "ignored", "SKILL.md"),
      "---\nname: ignored\ndescription: Must not load\n---\n# Ignored\n",
      "utf8",
    );
    await mkdir(join(rootPath, ".nextclaw"), { recursive: true });
    await writeFile(
      join(rootPath, ".nextclaw", "project.yaml"),
      "observation:\n  skills:\n    - root: custom-skills\n",
      "utf8",
    );
    const service = new ProjectMaterialService({
      projectManager: {
        getProjectById: vi.fn(async () => record),
      },
    });

    await expect(service.listSkills(record.id)).resolves.toEqual([
      expect.objectContaining({
        name: "alpha",
        description: "Alpha project skill",
        path: ".agents/skills/alpha/SKILL.md",
      }),
    ]);
  });

  it("rejects unknown projects instead of reading arbitrary paths", async () => {
    const service = new ProjectMaterialService({
      projectManager: {
        getProjectById: vi.fn(async () => null),
      },
    });

    await expect(service.getAgreement("missing")).rejects.toMatchObject({
      code: "PROJECT_NOT_FOUND",
    });
    await expect(service.listSkills("missing")).rejects.toMatchObject({
      code: "PROJECT_NOT_FOUND",
    });
  });
});
