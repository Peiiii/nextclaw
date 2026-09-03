import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectObservationSnapshot } from "@nextclaw/client-sdk";
import { ProjectArtifacts } from "./project-artifacts";

const observedAt = "2026-08-30T00:00:00.000Z";
const designs = Array.from({ length: 11 }, (_, index) => ({
  id: `design-${index + 1}`,
  path: `docs/designs/${index + 1}.md`,
  categoryId: "designs",
  categoryLabel: "Designs",
  exists: true,
  fileUpdatedAt: `2026-08-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
  references: [],
}));

const snapshot: ProjectObservationSnapshot = {
  asOf: observedAt,
  project: { name: "Research", rootPath: "/tmp/research", context: [] },
  sources: [],
  runs: [],
  artifactCategories: [
    { id: "plans", label: "Plans" },
    { id: "designs", label: "Designs" },
  ],
  artifacts: [
    ...designs,
    {
      id: "plan-1",
      path: "docs/plans/delivery.md",
      categoryId: "plans",
      categoryLabel: "Plans",
      exists: true,
      fileUpdatedAt: "2026-08-30T00:00:00.000Z",
      references: [],
    },
  ],
  skills: [],
  diagnostics: [],
  dataQuality: "complete",
};

describe("ProjectArtifacts", () => {
  it("groups in configuration order, expands incrementally, filters, and opens the selected file", () => {
    const onOpenFile = vi.fn();
    render(<ProjectArtifacts snapshot={snapshot} onOpenFile={onOpenFile} />);

    const groupHeaders = screen.getAllByRole("button", { name: /Plans 1|Designs 11/ });
    expect(groupHeaders.map((header) => header.getAttribute("aria-label"))).toEqual([
      "Plans 1",
      "Designs 11",
    ]);
    expect(screen.getByTitle("docs/designs/11.md")).toBeTruthy();
    expect(screen.queryByTitle("docs/designs/1.md")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Show more \(1\)/ }));
    expect(screen.getByTitle("docs/designs/1.md")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Search artifacts"), {
      target: { value: "delivery" },
    });
    expect(screen.queryByRole("button", { name: /Designs 11/ })).toBeNull();
    expect(screen.getByTitle("docs/plans/delivery.md")).toBeTruthy();
    fireEvent.click(screen.getByTitle("docs/plans/delivery.md"));
    expect(onOpenFile).toHaveBeenCalledWith("docs/plans/delivery.md", "docs/plans/delivery.md");

    const plansHeader = screen.getByRole("button", { name: /Plans 1/ });
    fireEvent.click(plansHeader);
    expect(plansHeader.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTitle("docs/plans/delivery.md")).toBeNull();
  });
});
