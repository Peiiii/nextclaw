import { render, screen } from "@testing-library/react";
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from "vitest";
import {
  ChatSidebarDesktopToolbar,
  ChatSidebarListToolbar,
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
  it("does not reserve a search row in the desktop header", () => {
    render(<ChatSidebarDesktopToolbar {...toolbarProps} />);
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("reveals desktop search below the list controls and clears it on close", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(<ChatSidebarListToolbar {...toolbarProps} onQueryChange={onQueryChange} isProjectFirstView={false} onSelectMode={vi.fn()} onAddProject={vi.fn()} />);
    expect(screen.queryByRole("textbox")).toBeNull();
    const trigger = screen.getByRole("button", { name: "Search conversations..." });
    await user.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole("textbox"));

    expect(searchIconClassName()).toContain("pointer-events-none");
    expect(
      screen.getByPlaceholderText("Search conversations...").className,
    ).toContain("border-0");
    expect(
      screen
        .getByPlaceholderText("Search conversations...")
        .getAttribute("data-theme-control"),
    ).toBe("chat-search");
    await user.type(screen.getByRole("textbox"), "a");
    expect(onQueryChange).toHaveBeenLastCalledWith("a");
    await user.click(screen.getByRole("button", { name: "Close search" }));
    expect(onQueryChange).toHaveBeenLastCalledWith("");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
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
