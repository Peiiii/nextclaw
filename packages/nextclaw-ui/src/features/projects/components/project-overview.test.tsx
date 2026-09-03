import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectOverview } from "./project-overview";

vi.mock(
  "@/features/projects/hooks/use-project-work",
  async (importOriginal) => ({
    ...(await importOriginal()),
    useProjectWorkEvents: vi.fn(),
    useProjectWorkSummary: () => ({
      data: { total: 4, active: 2, attention: 1, completed: 1 },
      isLoading: false,
      isError: false,
    }),
    useProjectWork: () => ({
      data: {
        pages: [
          {
            items: [
              {
                id: "work-1",
                title: "Current work",
                state: { name: "In Progress" },
              },
            ],
          },
        ],
      },
      isLoading: false,
      isError: false,
    }),
    useProjectArtifacts: () => ({
      data: {
        pages: [
          {
            artifacts: [
              {
                id: "artifact-1",
                path: "docs/design.md",
                label: "Design",
                workItemTitle: "Current work",
                createdAt: "2026-09-03T00:00:00.000Z",
                exists: true,
              },
            ],
            nextCursor: null,
            total: 1,
          },
        ],
      },
      isLoading: false,
      isError: false,
    }),
  }),
);

describe("ProjectOverview", () => {
  it("renders current work and recent artifacts as equal wide-layout columns", () => {
    const onOpenWorkItem = vi.fn();
    const onOpenArtifact = vi.fn();
    const { container } = render(
      <ProjectOverview
        projectId="project-1"
        onOpenWorkItem={onOpenWorkItem}
        onOpenArtifact={onOpenArtifact}
      />,
    );

    expect(screen.getByText(/Recently updated|最近更新/)).toBeTruthy();
    expect(screen.getByText(/Recent artifacts|最近产物/)).toBeTruthy();
    expect(container.querySelector(".lg\\:grid-cols-2")).toBeTruthy();

    fireEvent.click(
      screen.getAllByRole("button", { name: /Current work/ })[0]!,
    );
    fireEvent.click(screen.getByRole("button", { name: /Design/ }));
    expect(onOpenWorkItem).toHaveBeenCalledWith("work-1");
    expect(onOpenArtifact).toHaveBeenCalledWith("docs/design.md", "Design");
  });
});
