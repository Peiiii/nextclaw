import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsPage } from "./project-home-page";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  drawerProps: vi.fn(),
  removeProject: vi.fn(),
  useProjectObservation: vi.fn(),
  useProjects: vi.fn(),
}));

vi.mock("@/shared/hooks/use-projects", () => ({
  useProjects: mocks.useProjects,
  useRemoveProject: () => ({
    mutateAsync: mocks.removeProject,
    isPending: false,
  }),
}));
vi.mock("@/shared/hooks/use-confirm-dialog", () => ({
  useConfirmDialog: () => ({
    confirm: mocks.confirm,
    ConfirmDialog: () => <div data-testid="confirm-dialog" />,
  }),
}));
vi.mock("@/features/projects/hooks/use-project-observation", () => ({
  projectObservationQueryKey: (projectId: string) => [
    "project-observation",
    projectId,
  ],
  useProjectObservation: mocks.useProjectObservation,
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
  ProjectArtifacts: () => <div>Artifact content</div>,
}));
vi.mock("@/features/projects/components/project-skills", () => ({
  ProjectSkills: () => <div>Skills content</div>,
}));
vi.mock("@/features/projects/components/project-agreement", () => ({
  ProjectAgreement: () => <div>Agreement content</div>,
}));
vi.mock("@/features/projects/components/project-requests", () => ({
  ProjectRequests: () => null,
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
    mocks.confirm.mockReset();
    mocks.confirm.mockResolvedValue(true);
    mocks.removeProject.mockReset();
    mocks.removeProject.mockResolvedValue(undefined);
    mocks.useProjects.mockReturnValue({
      data: {
        projects: [
          { id: "project-1", name: "Research", rootPath: "/tmp/research" },
        ],
      },
      isLoading: false,
      isError: false,
    });
    mocks.useProjectObservation.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
  });

  it("keeps overview scan-free and opens its work item in the unified drawer", () => {
    renderPage("/projects/project-1/overview");

    expect(mocks.useProjectObservation).toHaveBeenCalledWith(
      "project-1",
      "/tmp/research",
      false,
    );
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Overview work" }));
    expect(screen.getByTestId("work-drawer").textContent).toBe("work-overview");
  });

  it("enables legacy observation only for preserved artifact, skill, and agreement surfaces", () => {
    mocks.useProjectObservation.mockReturnValue({
      data: { requests: [] },
      isLoading: false,
      isError: false,
    });
    renderPage("/projects/project-1/artifacts");

    expect(mocks.useProjectObservation).toHaveBeenCalledWith(
      "project-1",
      "/tmp/research",
      true,
    );
    expect(screen.getByText("Artifact content")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Skills/ })).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: /Working rules|工作约定/ }),
    ).toBeTruthy();
  });

  it("asks the user to choose from the sidebar when no project route is selected", () => {
    renderPage("/projects");
    expect(mocks.useProjectObservation).toHaveBeenCalledWith(null, null, false);
    expect(screen.getByText(/Choose a project|选择项目/)).toBeTruthy();
  });

  it("explains the impact before removing a project and returns to project selection", async () => {
    renderPage("/projects/project-1/overview");

    fireEvent.click(
      screen.getByRole("button", {
        name: /Remove from project list|从项目列表移除/,
      }),
    );

    await vi.waitFor(() =>
      expect(mocks.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringMatching(/local folder|本地目录/),
          variant: "destructive",
        }),
      ),
    );
    await vi.waitFor(() =>
      expect(mocks.removeProject).toHaveBeenCalledWith("project-1"),
    );
    await vi.waitFor(() =>
      expect(screen.getByText(/Choose a project|选择项目/)).toBeTruthy(),
    );
  });

  it("keeps the project when removal is cancelled", async () => {
    mocks.confirm.mockResolvedValue(false);
    renderPage("/projects/project-1/overview");

    fireEvent.click(
      screen.getByRole("button", {
        name: /Remove from project list|从项目列表移除/,
      }),
    );

    await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledOnce());
    expect(mocks.removeProject).not.toHaveBeenCalled();
    expect(screen.getByText("Research")).toBeTruthy();
  });
});
