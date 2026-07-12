import { render, screen } from "@testing-library/react";
import { Globe } from "lucide-react";
import { ToolCardHeader } from "./tool-card-header";

it("keeps expand chevron tight after text and rotates when expanded", () => {
  const { container, rerender } = render(
    <ToolCardHeader
      card={{
        kind: "call",
        toolName: "read",
        summary: "path: /Users/peiwang/.nextclaw/workspace/skills/bird/SKILL.md",
        hasResult: false,
        statusTone: "success",
        statusLabel: "Completed",
        titleLabel: "Tool Call",
        outputLabel: "View Output",
        emptyLabel: "No output",
      }}
      icon={Globe}
      expanded={false}
      canExpand
      onToggle={() => {}}
    />,
  );

  expect(screen.getByText("read")).toBeTruthy();
  const row = container.firstElementChild as HTMLElement;
  expect(row.className).toContain("group/process-row");

  const collapsedChevron = row.querySelector("svg.lucide-chevron-right") as SVGElement | null;
  expect(collapsedChevron).toBeTruthy();
  expect(collapsedChevron?.className.baseVal || collapsedChevron?.getAttribute("class") || "").not.toContain(
    "rotate-90",
  );

  rerender(
    <ToolCardHeader
      card={{
        kind: "call",
        toolName: "read",
        summary: "path: /Users/peiwang/.nextclaw/workspace/skills/bird/SKILL.md",
        hasResult: false,
        statusTone: "success",
        statusLabel: "Completed",
        titleLabel: "Tool Call",
        outputLabel: "View Output",
        emptyLabel: "No output",
      }}
      icon={Globe}
      expanded
      canExpand
      onToggle={() => {}}
    />,
  );

  const expandedChevron = container.querySelector("svg.lucide-chevron-right") as SVGElement | null;
  expect(expandedChevron?.className.baseVal || expandedChevron?.getAttribute("class") || "").toContain(
    "rotate-90",
  );
});
