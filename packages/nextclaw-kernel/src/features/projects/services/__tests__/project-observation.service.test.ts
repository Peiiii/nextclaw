import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NcpSessionSummary } from "@nextclaw/ncp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectObservationService } from "@kernel/features/projects/index.js";
import type {
  ProjectObservationError,
  ProjectRecord,
} from "@kernel/features/projects/index.js";

const temporaryRoots: string[] = [];

async function createProjectRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "nextclaw-project-observation-"));
  temporaryRoots.push(root);
  return root;
}

function project(rootPath: string): ProjectRecord {
  return {
    name: "Sample Project",
    rootPath,
    createdAt: "2026-08-30T00:00:00.000Z",
    updatedAt: "2026-08-30T00:00:00.000Z",
  };
}

function session(rootPath: string): NcpSessionSummary {
  return {
    sessionId: "session-1",
    messageCount: 2,
    updatedAt: "2026-08-30T10:05:00.000Z",
    agentId: "agent-primary",
    status: "running",
    metadata: {
      project_root: rootPath,
      preferred_model: "openai/gpt-5.6-luna",
      last_activity_preview: {
        state: "running",
        statusText: "Editing files",
        timestamp: "2026-08-30T10:02:00.000Z",
      },
    },
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("ProjectObservationService", () => {
  it("observes config, files, skills and session summaries without reading message text", async () => {
    const rootPath = await createProjectRoot();
    await mkdir(join(rootPath, ".nextclaw"), { recursive: true });
    await mkdir(join(rootPath, "docs", "designs"), { recursive: true });
    await mkdir(join(rootPath, ".agents", "skills", "project-review"), {
      recursive: true,
    });
    await writeFile(join(rootPath, "docs", "VISION.md"), "# Vision\n", "utf8");
    await writeFile(
      join(rootPath, "docs", "designs", "sample.md"),
      "# Design\n",
      "utf8",
    );
    await writeFile(
      join(rootPath, ".agents", "skills", "project-review", "SKILL.md"),
      "---\nname: project-review\ndescription: Review project evidence\n---\n",
      "utf8",
    );
    await writeFile(
      join(rootPath, ".nextclaw", "project.yaml"),
      `
schema_version: 1
project:
  summary: A long-running project
  context:
    - id: vision
      role: Vision
      source: docs/VISION.md
observation:
  artifacts:
    - id: designs
      label: Designs
      include:
        - docs/designs/**/*.md
  skills:
    - root: .agents/skills
`,
      "utf8",
    );
    const listSessionMessages = vi.fn(async () => [
      "old protocol-shaped text",
    ]);
    const sessionManager = {
      listSessions: vi.fn(async () => [session(rootPath)]),
      listSessionMessages,
    };
    const service = new ProjectObservationService({
      projectManager: {
        getRegisteredProject: vi.fn(async () => project(rootPath)),
      },
      sessionManager,
      workspacePath: rootPath,
      now: () => new Date("2026-08-30T11:00:00.000Z"),
    });

    const snapshot = await service.observe(rootPath);

    expect(snapshot.project).toMatchObject({
      name: "Sample Project",
      summary: "A long-running project",
      context: [{ id: "vision", accessible: true }],
    });
    expect(snapshot.artifactCategories).toEqual([
      { id: "designs", label: "Designs" },
    ]);
    expect(snapshot.artifacts).toEqual([
      expect.objectContaining({
        path: "docs/designs/sample.md",
        exists: true,
        fileCreatedAt: expect.any(String),
        fileUpdatedAt: expect.any(String),
      }),
    ]);
    expect(snapshot.runs).toEqual([
      expect.objectContaining({
        sessionId: "session-1",
        agentId: "agent-primary",
        model: "openai/gpt-5.6-luna",
        state: "running",
      }),
    ]);
    expect(snapshot.skills).toEqual([
      expect.objectContaining({
        name: "project-review",
        source: "project",
        readable: true,
      }),
    ]);
    expect(snapshot.dataQuality).toBe("complete");
    expect(listSessionMessages).not.toHaveBeenCalled();
  });

  it("reports session summary failures without attempting message fallback", async () => {
    const rootPath = await createProjectRoot();
    const listSessionMessages = vi.fn();
    const service = new ProjectObservationService({
      projectManager: {
        getRegisteredProject: vi.fn(async () => project(rootPath)),
      },
      sessionManager: {
        listSessions: vi.fn(async () => {
          throw new Error("session index unavailable");
        }),
        listSessionMessages,
      },
      workspacePath: rootPath,
    });

    const snapshot = await service.observe(rootPath);

    expect(snapshot.dataQuality).toBe("partial");
    expect(snapshot.sources.find((source) => source.id === "sessions")?.status)
      .toBe("error");
    expect(snapshot.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "PROJECT_SESSIONS_READ_FAILED" }),
      ]),
    );
    expect(listSessionMessages).not.toHaveBeenCalled();
  });

  it("keeps an unconfigured project observable without inventing facts", async () => {
    const rootPath = await createProjectRoot();
    const service = new ProjectObservationService({
      projectManager: {
        getRegisteredProject: vi.fn(async () => project(rootPath)),
      },
      sessionManager: { listSessions: vi.fn(async () => []) },
      workspacePath: rootPath,
    });

    const snapshot = await service.observe(rootPath);

    expect(snapshot.project).toMatchObject({
      name: "Sample Project",
      context: [],
    });
    expect(snapshot.artifacts).toEqual([]);
    expect(snapshot.dataQuality).toBe("complete");
    expect(snapshot.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PROJECT_CONFIG_NOT_FOUND",
          level: "info",
        }),
      ]),
    );
  });

  it("does not read unregistered project roots", async () => {
    const service = new ProjectObservationService({
      projectManager: { getRegisteredProject: vi.fn(async () => null) },
      sessionManager: { listSessions: vi.fn(async () => []) },
      workspacePath: "/workspace",
    });

    await expect(service.observe("/tmp/not-registered")).rejects.toEqual(
      expect.objectContaining<ProjectObservationError>({
        code: "PROJECT_NOT_REGISTERED",
      }),
    );
  });

  it("rejects context symlinks instead of reading outside the project", async () => {
    const rootPath = await createProjectRoot();
    const outsideRoot = await createProjectRoot();
    await mkdir(join(rootPath, ".nextclaw"), { recursive: true });
    await mkdir(join(rootPath, "docs"), { recursive: true });
    await writeFile(join(outsideRoot, "secret.md"), "private", "utf8");
    await symlink(
      join(outsideRoot, "secret.md"),
      join(rootPath, "docs", "VISION.md"),
    );
    await writeFile(
      join(rootPath, ".nextclaw", "project.yaml"),
      `
schema_version: 1
project:
  context:
    - id: vision
      role: Vision
      source: docs/VISION.md
`,
      "utf8",
    );
    const service = new ProjectObservationService({
      projectManager: {
        getRegisteredProject: vi.fn(async () => project(rootPath)),
      },
      sessionManager: { listSessions: vi.fn(async () => []) },
      workspacePath: rootPath,
    });

    const snapshot = await service.observe(rootPath);

    expect(snapshot.project.context).toEqual([
      expect.objectContaining({ id: "vision", accessible: false }),
    ]);
    expect(snapshot.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "PROJECT_CONTEXT_SOURCE_UNAVAILABLE" }),
      ]),
    );
  });
});
