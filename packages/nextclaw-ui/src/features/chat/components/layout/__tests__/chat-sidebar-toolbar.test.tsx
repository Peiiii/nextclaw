import { render, screen } from "@testing-library/react";
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from "vitest";
import {
  ChatSidebarDesktopToolbar,
  ChatSidebarListToolbar,
  ChatSidebarMobileToolbar,
} from "@/features/chat/components/layout/chat-sidebar-toolbar";
import type { ChatSessionTypeOption } from "@/features/chat/features/session-type/utils/chat-session-type.utils";
import { MemoryRouter } from 'react-router-dom';

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
  it('selects the scheduled mobile view and keeps task management a separate link', async () => {
    const user = userEvent.setup();
    const onSelectMode = vi.fn();
    render(<MemoryRouter><ChatSidebarMobileToolbar {...toolbarProps} listMode="scheduled" onSelectMode={onSelectMode} onAddProject={vi.fn()} /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Session list view' }));
    expect(screen.getByRole('button', { name: 'Scheduled' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('link', { name: 'Manage scheduled tasks' }).getAttribute('href')).toBe('/cron');
    await user.click(screen.getByRole('button', { name: 'Time' }));
    expect(onSelectMode).toHaveBeenCalledWith('time-first');
    expect(screen.queryByRole('button', { name: 'Time' })).toBeNull();
  });
  it("does not reserve a search row in the desktop header", () => {
    render(<ChatSidebarDesktopToolbar {...toolbarProps} />);
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("reveals desktop search below the list controls and clears it on close", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(<ChatSidebarListToolbar {...toolbarProps} onQueryChange={onQueryChange} listMode="time-first" onSelectMode={vi.fn()} onAddProject={vi.fn()} />);
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
    render(<ChatSidebarMobileToolbar {...toolbarProps} onQueryChange={onQueryChange} listMode="time-first" onSelectMode={vi.fn()} onAddProject={vi.fn()} />);
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
