import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatSidebarCreateMenu } from "@/features/chat/features/session-type/components/chat-sidebar-create-menu";
import { createPopoverAvailableHeightLimit } from "@/shared/components/ui/popover";

const options = [
  { value: "native", label: "Native", ready: true },
  { value: "codex", label: "Codex", ready: true },
];

describe("ChatSidebarCreateMenu", () => {
  it("keeps the session type menu height bounded", () => {
    render(<ChatSidebarCreateMenu options={options} onSelect={vi.fn()} />);

    const createMenu = screen.getByText("Session Type").parentElement;
    expect(createMenu?.style.maxHeight).toBe(
      createPopoverAvailableHeightLimit("18rem"),
    );
    expect(createMenu?.style.maxHeight).toContain("max(0px");
    expect(createMenu?.style.maxHeight).toContain("100vh");
    expect(createMenu?.style.maxHeight).toContain("2rem");
    expect(createMenu?.className).toContain("overflow-y-auto");
  });
});
