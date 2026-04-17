import { render, screen } from "@testing-library/react";
import { Globe } from "lucide-react";
import { ToolCardHeader } from "./tool-card-header";

it("keeps the summary in a shrinkable flex lane when header actions are present", () => {
  const { container } = render(
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
      actionSlot={<button type="button">Open</button>}
      onToggle={() => {}}
    />,
  );

  const summary = screen.getByTitle("/Users/peiwang/.nextclaw/workspace/skills/bird/SKILL.md");
  expect(summary.className).toContain("block");
  expect(summary.className).toContain("truncate");
  expect(summary.className).toContain("flex-1");
  expect(summary.className).toContain("min-w-0");

  const leftLane = container.firstElementChild?.firstElementChild as HTMLElement | null;
  expect(leftLane?.className).toContain("flex-1");
  expect(leftLane?.className).toContain("min-w-0");
  expect(leftLane?.className).toContain("overflow-hidden");
});
