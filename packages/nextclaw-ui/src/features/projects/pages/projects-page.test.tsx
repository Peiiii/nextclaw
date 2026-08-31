import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectObservationSnapshot } from "@nextclaw/client-sdk";
import { ProjectsPage } from "./project-home-page";

const mocks = vi.hoisted(() => ({
  useProjects: vi.fn(),
  useProjectObservation: vi.fn(),
  openFilePreview: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock("@/shared/hooks/use-projects", () => ({
  useProjects: mocks.useProjects,
}));
vi.mock("@/features/projects/hooks/use-project-observation", () => ({
  projectObservationQueryKey: (projectId: string) => [
    "project-observation",
    projectId,
  ],
  useProjectObservation: mocks.useProjectObservation,
}));
vi.mock("@/features/chat/components/providers/chat-presenter.provider", () => ({
  usePresenter: () => ({
    chatThreadManager: { openFilePreview: mocks.openFilePreview },
    chatSessionListManager: { createSession: mocks.createSession },
  }),
}));
vi.mock("@/features/chat/components/conversation/chat-conversation-workspace-section", () => ({
  ChatConversationWorkspaceSection: () => <div data-testid="project-workspace-preview" />,
}));

const observedAt = "2026-08-30T00:00:00.000Z";
const snapshot: ProjectObservationSnapshot = {
  asOf: observedAt,
  project: {
    name: "Research",
    rootPath: "/tmp/research",
    context: [{
      id: "vision",
      role: "Project vision",
      source: "docs/VISION.md",
      accessible: true,
      reference: {
        kind: "file-observation",
        label: "File observation",
        observedAt,
        projectRelativePath: "docs/VISION.md",
      },
    }],
  },
  sources: [
    {
      id: "config",
      label: "Project config",
      status: "error",
      itemCount: 0,
      observedAt,
      diagnosticIds: ["config:broken"],
    },
    {
      id: "files",
      label: "Project files",
      status: "empty",
      itemCount: 0,
      observedAt,
      diagnosticIds: [],
    },
    {
      id: "sessions",
      label: "Project sessions",
      status: "empty",
      itemCount: 0,
      observedAt,
      diagnosticIds: [],
    },
    {
      id: "skills",
      label: "Project Skills",
      status: "empty",
      itemCount: 0,
      observedAt,
      diagnosticIds: [],
    },
  ],
  workflows: [],
  runs: [],
  workItems: [],
  artifactCategories: [
    { id: "designs", label: "Designs" },
    { id: "plans", label: "Plans" },
  ],
  artifacts: [
    {
      id: "designs:docs/designs/observer.md",
      path: "docs/designs/observer.md",
      categoryId: "designs",
      categoryLabel: "Designs",
      exists: true,
      references: [],
    },
    {
      id: "plans:docs/plans/delivery.md",
      path: "docs/plans/delivery.md",
      categoryId: "plans",
      categoryLabel: "Plans",
      exists: true,
      references: [],
    },
  ],
  signals: [],
  requests: [],
  activity: [],
  skills: [
    {
      ref: "project:research-skill",
      name: "Research skill",
      description: "Collects and organizes source material.",
      source: "project",
      path: "/tmp/research/.agents/skills/research/SKILL.md",
      readable: true,
      reference: {
        kind: "project-config",
        label: "Project config",
        observedAt,
      },
    },
    {
      ref: "project:unavailable-skill",
      name: "Unavailable skill",
      source: "project",
      path: "/tmp/research/.agents/skills/unavailable/SKILL.md",
      readable: false,
      reference: {
        kind: "project-config",
        label: "Project config",
        observedAt,
      },
    },
  ],
  diagnostics: [
    {
      id: "config:broken",
      source: "config",
      level: "error",
      code: "PROJECT_CONFIG_PARSE_FAILED",
      message: "The project configuration is invalid.",
    },
  ],
  dataQuality: "partial",
};

describe("ProjectsPage", () => {
  beforeEach(() => {
    mocks.createSession.mockReset();
    mocks.useProjects.mockReturnValue({
      data: {
        projects: [
          {
            id: "project-research",
            name: "Research",
            rootPath: "/tmp/research",
            createdAt: observedAt,
            updatedAt: observedAt,
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    mocks.useProjectObservation.mockReturnValue({
      data: snapshot,
      isLoading: false,
      isError: false,
    });
  });

  it("uses the project selected by the sidebar route without rendering another selector", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/projects/project-research/overview"]}>
          <Routes>
            <Route path="/projects/:projectId/:tab" element={<ProjectsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(mocks.useProjectObservation).toHaveBeenCalledWith(
      "project-research",
      "/tmp/research",
    );
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByRole("tab", { name: "Skills" })).toBeTruthy();
    expect(
      screen.queryByText(
        /This project has no configured summary|项目没有配置摘要/,
      ),
    ).toBeNull();
    expect(screen.queryByText(/Partially available|部分可用/)).toBeNull();
    expect(screen.queryByText(observedAt)).toBeNull();
    expect(
      screen.getByText(
        /Set up project observation first|先建立项目观察配置/,
      ),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: /Let AI set up project observation|让 AI 帮我建立项目观察/,
      }),
    );
    expect(mocks.createSession).toHaveBeenCalledWith({
      projectRoot: "/tmp/research",
      prompt: expect.stringMatching(/project observation|项目观察/),
    });
    expect(mocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("AGENTS.md"),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /docs\/designs\/observer\.md/ }));
    expect(mocks.openFilePreview).toHaveBeenCalledWith({
      path: "docs/designs/observer.md",
      label: "docs/designs/observer.md",
      viewMode: "preview",
      previewViewer: "rendered",
    });

    fireEvent.click(screen.getByRole("tab", { name: /Work items|工作项/ }));
    expect(
      screen.queryByRole("heading", { name: /Work items|工作项/ }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /Artifacts|产物/ }));
    expect(
      screen.queryByRole("heading", { name: /Artifacts|产物/ }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: /Designs 1/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /docs\/plans\/delivery\.md/ })).toBeTruthy();
    expect(screen.queryByText(/File observed|文件已观测/)).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /Skills/ }));
    expect(screen.getByText("2 skills")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Skills" })).toBeNull();
    const skillPath = screen.getByText(
      "/tmp/research/.agents/skills/research/SKILL.md",
    );
    expect(skillPath.className).toContain("truncate");
    expect(skillPath.getAttribute("title")).toBe(
      "/tmp/research/.agents/skills/research/SKILL.md",
    );
    const skillDescription = screen.getByText(
      "Collects and organizes source material.",
    );
    expect(skillDescription.className).toContain("line-clamp-2");
    expect(skillDescription.getAttribute("title")).toBe(
      "Collects and organizes source material.",
    );
    expect(screen.queryByText(/Readable|可读取/)).toBeNull();
    expect(screen.getByText(/Unavailable|不可用/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Research skill/ }));
    expect(mocks.openFilePreview).toHaveBeenCalledWith({
      path: "/tmp/research/.agents/skills/research/SKILL.md",
      label: "Research skill",
      viewMode: "preview",
      previewViewer: "rendered",
    });

    fireEvent.click(
      screen.getByRole("tab", { name: /Working rules|工作约定/ }),
    );
    expect(
      screen.queryByRole("heading", { name: /Working rules|工作约定/ }),
    ).toBeNull();
    expect(
      screen.getByRole("heading", { name: /Vision and context|愿景与上下文/ }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Project vision/ }));
    expect(mocks.openFilePreview).toHaveBeenCalledWith({
      path: "docs/VISION.md",
      label: "Project vision",
      viewMode: "preview",
      previewViewer: "rendered",
    });
    expect(screen.getByText("PROJECT_CONFIG_PARSE_FAILED")).toBeTruthy();
  });

  it("keeps rendering while an older server snapshot has no runs field", () => {
    const { runs: _runs, ...legacySnapshot } = snapshot;
    mocks.useProjectObservation.mockReturnValue({
      data: legacySnapshot as ProjectObservationSnapshot,
      isLoading: false,
      isError: false,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/projects/project-research/overview"]}>
          <Routes>
            <Route path="/projects/:projectId/:tab" element={<ProjectsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByText(/No AI-reported activity|暂无 AI 上报动态/)).toBeTruthy();
  });

  it("asks the user to choose from the sidebar when the route has no registered project", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/projects"]}>
          <Routes>
            <Route path="/projects" element={<ProjectsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(mocks.useProjectObservation).toHaveBeenLastCalledWith(null, null);
    expect(screen.getByText(/Choose a project|选择项目/)).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("keeps the observation setup entry out of an already configured project", () => {
    mocks.useProjectObservation.mockReturnValue({
      data: {
        ...snapshot,
        sources: snapshot.sources.map((source) =>
          source.id === "config" ? { ...source, status: "available" as const } : source,
        ),
      },
      isLoading: false,
      isError: false,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/projects/project-research/overview"]}>
          <Routes>
            <Route path="/projects/:projectId/:tab" element={<ProjectsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      screen.queryByRole("button", {
        name: /Let AI set up project observation|让 AI 帮我建立项目观察/,
      }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: /Start project work|开始项目工作/,
      }),
    );
    expect(mocks.createSession).toHaveBeenCalledWith({
      projectRoot: "/tmp/research",
      prompt: expect.stringMatching(/Start working on this project|请开始处理这个项目/),
    });
  });
});
