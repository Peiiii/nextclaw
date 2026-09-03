import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsPage } from "./project-home-page";

const mocks = vi.hoisted(() => ({
  agreementProps: vi.fn(),
  artifactsProps: vi.fn(),
  drawerProps: vi.fn(),
  skillsProps: vi.fn(),
  useProjectAgreement: vi.fn(),
  useProjectSkills: vi.fn(),
  useProjects: vi.fn(),
}));

vi.mock("@/shared/hooks/use-projects", () => ({
  useProjects: mocks.useProjects,
}));
vi.mock("@/features/projects/hooks/use-project-materials", () => ({
  useProjectAgreement: mocks.useProjectAgreement,
  useProjectSkills: mocks.useProjectSkills,
}));
vi.mock("@/features/chat", () => ({
  ChatConversationWorkspaceSection: () => <div data-testid="workspace" />,
  usePresenter: () => ({ chatThreadManager: { openFilePreview: vi.fn() } }),
}));
vi.mock("@/app/hooks/use-viewport-layout", () => ({
  useViewportLayout: () => ({ isMobile: false }),
}));
vi.mock("@/features/projects/components/project-overview", () => ({
  ProjectOverview: ({
    onOpenWorkItem,
  }: {
    onOpenWorkItem: (id: string) => void;
  }) => (
    <button onClick={() => onOpenWorkItem("work-overview")}>
      Overview work
    </button>
  ),
}));
vi.mock("@/features/projects/components/work/project-work-items", () => ({
  ProjectWorkItems: ({
    onOpenWorkItem,
  }: {
    onOpenWorkItem: (id: string) => void;
  }) => <button onClick={() => onOpenWorkItem("work-list")}>List work</button>,
}));
vi.mock("@/features/projects/components/work/project-work-item-drawer", () => ({
  ProjectWorkItemDrawer: ({ workItemId }: { workItemId: string | null }) => {
    mocks.drawerProps({ workItemId });
    return <div data-testid="work-drawer">{workItemId}</div>;
  },
}));
vi.mock("@/features/projects/components/project-artifacts", () => ({
  ProjectArtifacts: (props: { projectId: string }) => {
    mocks.artifactsProps(props);
    return <div>Artifact content</div>;
  },
}));
vi.mock("@/features/projects/components/project-skills", () => ({
  ProjectSkills: (props: { skills: unknown[] }) => {
    mocks.skillsProps(props);
    return <div>Skills content</div>;
  },
}));
vi.mock("@/features/projects/components/project-agreement", () => ({
  ProjectAgreement: (props: { agreement?: unknown }) => {
    mocks.agreementProps(props);
    return <div>Agreement content</div>;
  },
}));
function renderPage(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId/:tab" element={<ProjectsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProjectsPage", () => {
  beforeEach(() => {
    mocks.drawerProps.mockReset();
    mocks.agreementProps.mockReset();
    mocks.artifactsProps.mockReset();
    mocks.skillsProps.mockReset();
    mocks.useProjects.mockReturnValue({
      data: {
        projects: [
          { id: "project-1", name: "Research", rootPath: "/tmp/research" },
        ],
      },
      isLoading: false,
      isError: false,
    });
    mocks.useProjectAgreement.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
    mocks.useProjectSkills.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
  });

  it("keeps overview material-free and opens its work item in the unified drawer", () => {
    renderPage("/projects/project-1/overview");

    expect(mocks.useProjectAgreement).toHaveBeenCalledWith(null);
    expect(mocks.useProjectSkills).toHaveBeenCalledWith(null);
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Overview work" }));
    expect(screen.getByTestId("work-drawer").textContent).toBe("work-overview");
  });

  it("loads artifacts from project work without material observation", () => {
    renderPage("/projects/project-1/artifacts");

    expect(mocks.useProjectAgreement).toHaveBeenCalledWith(null);
    expect(mocks.useProjectSkills).toHaveBeenCalledWith(null);
    expect(mocks.artifactsProps).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "project-1" }),
    );
    expect(screen.getByText("Artifact content")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Skills/ })).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: /Working rules|工作约定/ }),
    ).toBeTruthy();
  });

  it("asks the user to choose from the sidebar when no project route is selected", () => {
    renderPage("/projects");
    expect(mocks.useProjectAgreement).toHaveBeenCalledWith(null);
    expect(mocks.useProjectSkills).toHaveBeenCalledWith(null);
    expect(screen.getByText(/Choose a project|选择项目/)).toBeTruthy();
  });

  it("loads each fixed project material only on its own tab", () => {
    mocks.useProjectAgreement.mockReturnValue({
      data: { path: "AGENTS.md", available: true },
      isLoading: false,
      isError: false,
    });
    const { unmount } = renderPage("/projects/project-1/agreement");
    expect(mocks.useProjectAgreement).toHaveBeenCalledWith("project-1");
    expect(mocks.useProjectSkills).toHaveBeenCalledWith(null);
    expect(mocks.agreementProps).toHaveBeenCalledWith(
      expect.objectContaining({
        agreement: { path: "AGENTS.md", available: true },
      }),
    );
    unmount();

    mocks.useProjectSkills.mockReturnValue({
      data: [{ ref: "project:alpha", name: "alpha" }],
      isLoading: false,
      isError: false,
    });
    renderPage("/projects/project-1/skills");
    expect(mocks.useProjectAgreement).toHaveBeenLastCalledWith(null);
    expect(mocks.useProjectSkills).toHaveBeenLastCalledWith("project-1");
    expect(mocks.skillsProps).toHaveBeenCalledWith(
      expect.objectContaining({
        skills: [{ ref: "project:alpha", name: "alpha" }],
      }),
    );
  });

  it("does not expose project removal as a persistent detail-page action", () => {
    renderPage("/projects/project-1/overview");

    expect(
      screen.queryByRole("button", {
        name: /Remove from project list|从项目列表移除/,
      }),
    ).toBeNull();
    expect(screen.getByText("Research")).toBeTruthy();
  });
});
