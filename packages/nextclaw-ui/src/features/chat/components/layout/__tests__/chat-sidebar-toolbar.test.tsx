import { render, screen } from "@testing-library/react";
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from "vitest";
import {
  ChatSidebarDesktopToolbar,
  ChatSidebarMobileToolbar,
} from "@/features/chat/components/layout/chat-sidebar-toolbar";
import type { ChatSessionTypeOption } from "@/features/chat/features/session-type/utils/chat-session-type.utils";

const sessionTypeOptions: ChatSessionTypeOption[] = [
  { value: "native", label: "Native", icon: null, ready: true },
  { value: "codex", label: "Codex", icon: null, ready: true },
];

const toolbarProps = {
  query: "",
  defaultSessionType: "native",
  sessionTypeOptions,
  selectedNewSessionType: "native",
  selectedNewSessionTypeOption: sessionTypeOptions[0],
  isCreateMenuOpen: false,
  onCreateMenuOpenChange: vi.fn(),
  onCreateSession: vi.fn(),
  onSelectNewSessionType: vi.fn(),
  onQueryChange: vi.fn(),
};

function searchIconClassName() {
  return (
    screen
      .getByPlaceholderText("Search conversations...")
      .previousElementSibling?.getAttribute("class") ?? ""
  );
}

describe("ChatSidebarToolbar", () => {
  it("keeps desktop search icon transparent to pointer input", () => {
    render(<ChatSidebarDesktopToolbar {...toolbarProps} />);

    expect(searchIconClassName()).toContain("pointer-events-none");
    expect(
      screen.getByPlaceholderText("Search conversations...").className,
    ).toContain("border-0");
    expect(
      screen
        .getByPlaceholderText("Search conversations...")
        .getAttribute("data-theme-control"),
    ).toBe("chat-search");
  });

  it('reveals mobile search on demand and clears the filter when closed', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(<ChatSidebarMobileToolbar {...toolbarProps} onQueryChange={onQueryChange} isProjectFirstView={false} onSelectMode={vi.fn()} onAddProject={vi.fn()} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Search conversations...' }));
    const search = screen.getByRole('textbox');
    expect(document.activeElement).toBe(search);
    await user.type(search, 'a');
    expect(onQueryChange).toHaveBeenLastCalledWith('a');
    await user.click(screen.getByRole('button', { name: 'Close search' }));
    expect(onQueryChange).toHaveBeenLastCalledWith('');
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
