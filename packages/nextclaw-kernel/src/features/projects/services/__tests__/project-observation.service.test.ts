import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { NcpMessage, NcpSessionSummary } from "@nextclaw/ncp";
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

function message(params: {
  id: string;
  role: "assistant" | "user";
  text: string;
  metadata?: Record<string, unknown>;
  status?: NcpMessage["status"];
  timestamp?: string;
}): NcpMessage {
  const { id, role, text, metadata, status, timestamp } = params;
  return {
    id,
    sessionId: "session-1",
    role,
    status: status ?? "final",
    timestamp: timestamp ?? "2026-08-30T10:00:00.000Z",
    parts: [{ type: "text", text }],
    ...(metadata ? { metadata } : {}),
  };
}

function session(rootPath: string, sessionId = "session-1"): NcpSessionSummary {
  return {
    sessionId,
    messageCount: 2,
    updatedAt: "2026-08-30T10:05:00.000Z",
    metadata: { project_root: rootPath },
  };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

// These independent service contracts share a single fixture lifecycle; splitting the suite would
// duplicate cleanup and obscure the observation service's boundary-level behavior.
// eslint-disable-next-line max-lines-per-function
describe("ProjectObservationService", () => {
  it("builds one traceable snapshot from config, files, markers, responses and project skills", async () => {
    const rootPath = await createProjectRoot();
    await mkdir(join(rootPath, ".nextclaw"), { recursive: true });
    await mkdir(join(rootPath, "docs", "designs"), { recursive: true });
    await mkdir(join(rootPath, ".agents", "skills", "project-review"), { recursive: true });
    await writeFile(join(rootPath, "docs", "VISION.md"), "# Vision\n", "utf8");
    await writeFile(join(rootPath, "docs", "designs", "sample.md"), "# Design\n", "utf8");
    await writeFile(join(rootPath, ".agents", "skills", "project-review", "SKILL.md"), "---\nname: project-review\ndescription: Review project evidence\n---\n", "utf8");
    await writeFile(join(rootPath, ".nextclaw", "project.yaml"), `
schema_version: 1
project:
  summary: A long-running project
  context:
    - id: vision
      role: Vision
      source: docs/VISION.md
workflows:
  - id: development
    label: Development
    stages:
      - id: implementation
        label: Implementation
observation:
  markers:
    - protocol: nextclaw.project/v1
  artifacts:
    - id: designs
      label: Designs
      include:
        - docs/designs/**/*.md
  skills:
    - root: .agents/skills
`, "utf8");
    const listSessionMessages = vi.fn(async () => [
      message({
        id: "assistant-1",
        role: "assistant",
        text: [
          '[nextclaw.project/v1 kind=work-item id=sample title="Build the sample" workflow=development stage=implementation status=active]',
          '[nextclaw.project/v1 kind=artifact item=sample path="docs/designs/sample.md" category=designs]',
          '[nextclaw.project/v1 kind=request id=approve item=sample status=open response=confirm-reject prompt="Approve delivery"]',
        ].join("\n"),
      }),
      message({
        id: "user-1",
        role: "user",
        text: "Confirmed",
        timestamp: "2026-08-30T10:01:00.000Z",
        metadata: {
          project_observation_response: {
            protocol: "nextclaw.project/v1",
            requestId: "approve",
            decision: "confirmed",
          },
        },
      }),
    ]);
    const service = new ProjectObservationService({
      projectManager: { getRegisteredProject: vi.fn(async () => project(rootPath)) },
      sessionManager: {
        listSessions: vi.fn(async () => [session(rootPath)]),
        listSessionMessages,
      },
      workspacePath: rootPath,
      now: () => new Date("2026-08-30T11:00:00.000Z"),
    });

    const snapshot = await service.observe(rootPath);

    expect(snapshot.project).toMatchObject({
      name: "Sample Project",
      summary: "A long-running project",
      context: [{ id: "vision", accessible: true }],
    });
    expect(snapshot.workItems).toEqual([
      expect.objectContaining({ id: "sample", workflowId: "development", stageId: "implementation" }),
    ]);
    expect(snapshot.artifactCategories).toEqual([{ id: "designs", label: "Designs" }]);
    expect(snapshot.artifacts).toEqual([
      expect.objectContaining({
        path: "docs/designs/sample.md",
        exists: true,
        itemId: "sample",
        fileCreatedAt: expect.any(String),
        fileUpdatedAt: expect.any(String),
      }),
    ]);
    expect(snapshot.requests[0]).toMatchObject({
      id: "approve",
      status: "open",
      reply: { decision: "confirmed", messageId: "user-1" },
    });
    expect(snapshot.skills).toEqual([
      expect.objectContaining({ name: "project-review", source: "project", readable: true }),
    ]);
    expect(snapshot.dataQuality).toBe("complete");
    expect(listSessionMessages).toHaveBeenCalledWith("session-1");
  });

  it("keeps available sources when one session source fails", async () => {
    const rootPath = await createProjectRoot();
    await mkdir(join(rootPath, "docs"), { recursive: true });
    const service = new ProjectObservationService({
      projectManager: { getRegisteredProject: vi.fn(async () => project(rootPath)) },
      sessionManager: {
        listSessions: vi.fn(async () => [session(rootPath)]),
        listSessionMessages: vi.fn(async () => { throw new Error("journal unavailable"); }),
      },
      workspacePath: rootPath,
    });

    const snapshot = await service.observe(rootPath);

    expect(snapshot.project.name).toBe("Sample Project");
    expect(snapshot.dataQuality).toBe("partial");
    expect(snapshot.sources.find((source) => source.id === "sessions")?.status).toBe("error");
    expect(snapshot.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "PROJECT_SESSION_MESSAGES_READ_FAILED" }),
    ]));
  });

  it("projects compact stage transitions together with the existing session run facts", async () => {
    const rootPath = await createProjectRoot();
    await mkdir(join(rootPath, ".nextclaw"), { recursive: true });
    await writeFile(join(rootPath, ".nextclaw", "project.yaml"), `
schema_version: 1
project:
  context: []
workflows:
  - id: general-work
    label: General work
    stages:
      - id: exploration
        label: Exploration
      - id: design
        label: Design
observation:
  markers:
    - protocol: nextclaw.project/v1
  artifacts: []
  skills:
    - root: .agents/skills
`, "utf8");
    const projectSession: NcpSessionSummary = {
      ...session(rootPath),
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
    const service = new ProjectObservationService({
      projectManager: { getRegisteredProject: vi.fn(async () => project(rootPath)) },
      sessionManager: {
        listSessions: vi.fn(async () => [projectSession]),
        listSessionMessages: vi.fn(async () => [
          message({
            id: "assistant-start",
            role: "assistant",
            status: "streaming",
            timestamp: "2026-08-30T10:00:00.000Z",
            text: [
              "```text",
              '[nextclaw.project/v1 id=<work-item-id> name="Example only" stage=<stage-id>]',
              "```",
              '[nextclaw.project/v1 id=wi_7km4q2x9dn name="Implement live tracking" stage=exploration]',
            ].join("\n"),
          }),
          message({
            id: "assistant-design",
            role: "assistant",
            timestamp: "2026-08-30T10:01:00.000Z",
            text: "[nextclaw.project/v1 stage=design]",
          }),
        ]),
      },
      workspacePath: rootPath,
    });

    const snapshot = await service.observe(rootPath);

    expect(snapshot.workItems).toEqual([
      expect.objectContaining({
        id: "wi_7km4q2x9dn",
        name: "Implement live tracking",
        workflowId: "general-work",
        stageId: "design",
        status: "active",
      }),
    ]);
    expect(snapshot.runs).toEqual([
      expect.objectContaining({
        sessionId: "session-1",
        agentId: "agent-primary",
        model: "openai/gpt-5.6-luna",
        state: "running",
        workItemId: "wi_7km4q2x9dn",
      }),
    ]);
    expect(snapshot.activity).toHaveLength(2);
    expect(snapshot.diagnostics).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "PROJECT_MARKER_INVALID" }),
    ]));
  });

  it("keeps an unconfigured project observable without inventing project facts", async () => {
    const rootPath = await createProjectRoot();
    const service = new ProjectObservationService({
      projectManager: { getRegisteredProject: vi.fn(async () => project(rootPath)) },
      sessionManager: {
        listSessions: vi.fn(async () => []),
        listSessionMessages: vi.fn(async () => []),
      },
      workspacePath: rootPath,
    });

    const snapshot = await service.observe(rootPath);

    expect(snapshot.project).toMatchObject({ name: "Sample Project", context: [] });
    expect(snapshot.workflows).toEqual([]);
    expect(snapshot.workItems).toEqual([]);
    expect(snapshot.artifacts).toEqual([]);
    expect(snapshot.dataQuality).toBe("complete");
    expect(snapshot.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "PROJECT_CONFIG_NOT_FOUND", level: "info" }),
    ]));
  });

  it("does not read unregistered project roots", async () => {
    const service = new ProjectObservationService({
      projectManager: { getRegisteredProject: vi.fn(async () => null) },
      sessionManager: {
        listSessions: vi.fn(async () => []),
        listSessionMessages: vi.fn(async () => []),
      },
      workspacePath: "/workspace",
    });

    await expect(service.observe("/tmp/not-registered")).rejects.toEqual(
      expect.objectContaining<ProjectObservationError>({ code: "PROJECT_NOT_REGISTERED" }),
    );
  });

  it("diagnoses marker paths that escape the project", async () => {
    const rootPath = await createProjectRoot();
    const service = new ProjectObservationService({
      projectManager: { getRegisteredProject: vi.fn(async () => project(rootPath)) },
      sessionManager: {
        listSessions: vi.fn(async () => [session(rootPath)]),
        listSessionMessages: vi.fn(async () => [message({
          id: "assistant-escape",
          role: "assistant",
          text: '[nextclaw.project/v1 kind=artifact item=sample path="../secret.txt" category=files]',
        })]),
      },
      workspacePath: rootPath,
    });

    const snapshot = await service.observe(rootPath);

    expect(snapshot.artifacts[0]).toMatchObject({ path: "../secret.txt", exists: false });
    expect(snapshot.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "PROJECT_MARKER_ARTIFACT_UNAVAILABLE" }),
    ]));
  });

  it("rejects context symlinks instead of reading outside the project", async () => {
    const rootPath = await createProjectRoot();
    const outsideRoot = await createProjectRoot();
    await mkdir(join(rootPath, ".nextclaw"), { recursive: true });
    await mkdir(join(rootPath, "docs"), { recursive: true });
    await writeFile(join(outsideRoot, "secret.md"), "private", "utf8");
    await symlink(join(outsideRoot, "secret.md"), join(rootPath, "docs", "VISION.md"));
    await writeFile(join(rootPath, ".nextclaw", "project.yaml"), `
schema_version: 1
project:
  context:
    - id: vision
      role: Vision
      source: docs/VISION.md
`, "utf8");
    const service = new ProjectObservationService({
      projectManager: { getRegisteredProject: vi.fn(async () => project(rootPath)) },
      sessionManager: {
        listSessions: vi.fn(async () => []),
        listSessionMessages: vi.fn(async () => []),
      },
      workspacePath: rootPath,
    });

    const snapshot = await service.observe(rootPath);

    expect(snapshot.project.context).toEqual([
      expect.objectContaining({ id: "vision", accessible: false }),
    ]);
    expect(snapshot.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "PROJECT_CONTEXT_SOURCE_UNAVAILABLE" }),
    ]));
  });

  it("reports equal-time marker conflicts and resolves them deterministically", async () => {
    const rootPath = await createProjectRoot();
    const service = new ProjectObservationService({
      projectManager: { getRegisteredProject: vi.fn(async () => project(rootPath)) },
      sessionManager: {
        listSessions: vi.fn(async () => [session(rootPath, "session-2"), session(rootPath, "session-1")]),
        listSessionMessages: vi.fn(async (sessionId: string) => [message({
          id: `message-${sessionId}`,
          role: "assistant",
          text: `[nextclaw.project/v1 kind=work-item id=shared title="Shared item" workflow=none stage=none status=${sessionId === "session-2" ? "blocked" : "active"}]`,
        })]),
      },
      workspacePath: rootPath,
    });

    const snapshot = await service.observe(rootPath);

    expect(snapshot.workItems).toEqual([
      expect.objectContaining({ id: "shared", status: "blocked" }),
    ]);
    expect(snapshot.dataQuality).toBe("partial");
    expect(snapshot.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "PROJECT_MARKER_CONFLICT" }),
    ]));
  });
});
