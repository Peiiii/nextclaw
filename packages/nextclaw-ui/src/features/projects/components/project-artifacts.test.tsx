import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectArtifacts } from "./project-artifacts";

const useProjectArtifacts = vi.fn();

vi.mock(
  "@/features/projects/hooks/use-project-work",
  async (importOriginal) => ({
    ...(await importOriginal()),
    useProjectArtifacts: (...args: unknown[]) => useProjectArtifacts(...args),
  }),
);

describe("ProjectArtifacts", () => {
  it("loads linked artifacts, searches through the owner, and opens available files", () => {
    useProjectArtifacts.mockReturnValue({
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
            total: 1,
            nextCursor: null,
          },
        ],
      },
      isLoading: false,
      isError: false,
      hasNextPage: false,
    });
    const onOpenFile = vi.fn();
    render(<ProjectArtifacts projectId="project-1" onOpenFile={onOpenFile} />);

    fireEvent.click(screen.getByRole("button", { name: /Design/ }));
    expect(onOpenFile).toHaveBeenCalledWith("docs/design.md", "Design");

    fireEvent.change(screen.getByPlaceholderText(/Search artifacts|搜索产物/), {
      target: { value: "report" },
    });
    expect(useProjectArtifacts).toHaveBeenLastCalledWith("project-1", {
      limit: 20,
      query: "report",
    });
  });

  it("explains that artifacts come from work-item links", () => {
    useProjectArtifacts.mockReturnValue({
      data: { pages: [{ artifacts: [], total: 0, nextCursor: null }] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
    });

    render(<ProjectArtifacts projectId="project-1" onOpenFile={vi.fn()} />);

    expect(
      screen.getByText(/Link a file from a work item|从工作项关联文件/),
    ).toBeTruthy();
  });

  it("keeps missing links visible and loads the next page explicitly", () => {
    const fetchNextPage = vi.fn();
    useProjectArtifacts.mockReturnValue({
      data: {
        pages: [
          {
            artifacts: [
              {
                id: "artifact-missing",
                path: "docs/missing.md",
                label: null,
                workItemTitle: "Archived work",
                createdAt: "2026-09-03T00:00:00.000Z",
                exists: false,
              },
            ],
            total: 21,
            nextCursor: "next",
          },
        ],
      },
      isLoading: false,
      isError: false,
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage,
    });

    render(<ProjectArtifacts projectId="project-1" onOpenFile={vi.fn()} />);

    expect(screen.getByText(/Currently unavailable|暂不可用/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /missing\.md/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Show more|显示更多/ }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });
});
