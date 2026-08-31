import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectObservationSnapshot } from "@nextclaw/client-sdk";
import { ProjectWorkItems } from "./project-work-items";

const reference = {
  kind: "ai-report" as const,
  label: "AI report",
  observedAt: "2026-08-30T00:00:00.000Z",
  sessionId: "session-1",
};

function createSnapshot(): ProjectObservationSnapshot {
  return {
    asOf: reference.observedAt,
    project: { name: "Demo", rootPath: "/tmp/demo", context: [] },
    sources: [],
    workflows: [{
      id: "research",
      label: "Research",
      stages: [{ id: "draft", label: "Draft" }],
      reference,
    }],
    runs: [],
    workItems: [{
      id: "report",
      name: "Write the report",
      status: "active",
      workflowId: "research",
      stageId: "draft",
      updatedAt: reference.observedAt,
      reference,
    }],
    artifactCategories: [], artifacts: [], signals: [], requests: [], activity: [], skills: [], diagnostics: [],
    dataQuality: "complete",
  };
}

describe("ProjectWorkItems", () => {
  it("switches list, board, and gantt over one snapshot without fabricating a schedule", () => {
    render(
      <ProjectWorkItems
        hasProjectSessions
        snapshot={createSnapshot()}
        shouldOfferObservationSetup={false}
        onStartObservationSetup={vi.fn()}
        onStartProjectWork={vi.fn()}
      />,
    );
    expect(screen.getByText("Write the report")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Board|看板/ }));
    expect(screen.getByText("Draft")).toBeTruthy();
    expect(screen.getByText("Write the report")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Gantt|甘特图/ }));
    expect(screen.getByText(/No schedule markers|没有 schedule Marker/)).toBeTruthy();
  });

  it("offers an ordinary project conversation before rendering empty view controls", () => {
    const onStartProjectWork = vi.fn();
    render(
      <ProjectWorkItems
        hasProjectSessions={false}
        snapshot={{ ...createSnapshot(), workItems: [] }}
        shouldOfferObservationSetup={false}
        onStartObservationSetup={vi.fn()}
        onStartProjectWork={onStartProjectWork}
      />,
    );

    expect(screen.queryByRole("group", { name: /Work item views|工作项视图/ })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /Start project work|开始项目工作/ }),
    );
    expect(onStartProjectWork).toHaveBeenCalledOnce();
  });
});
