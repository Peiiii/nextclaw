import { render, screen } from "@testing-library/react";
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
  nonDefaultSessionTypeOptions: [sessionTypeOptions[1]],
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
  });

  it("keeps mobile search icon transparent to pointer input", () => {
    render(<ChatSidebarMobileToolbar {...toolbarProps} />);

    expect(searchIconClassName()).toContain("pointer-events-none");
  });
});
