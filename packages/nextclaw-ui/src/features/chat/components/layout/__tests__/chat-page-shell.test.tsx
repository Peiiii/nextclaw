import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatPageLayout } from "@/features/chat/components/layout/chat-page-shell";

const { useViewportLayoutMock } = vi.hoisted(() => ({
  useViewportLayoutMock: vi.fn(() => ({
    mode: "desktop" as "mobile" | "desktop",
    isMobile: false,
    isDesktop: true,
  })),
}));

vi.mock("@/app/hooks/use-viewport-layout", () => ({
  useViewportLayout: useViewportLayoutMock,
}));

vi.mock("@/features/chat/components/layout/chat-sidebar", () => ({
  ChatSidebar: () => <div data-testid="desktop-chat-sidebar">Desktop Sidebar</div>,
}));

vi.mock("@/features/chat/components/conversation/chat-conversation-panel", () => ({
  ChatConversationPanel: () => <div data-testid="chat-conversation-panel">Conversation</div>,
}));

vi.mock("@/platforms/mobile", () => ({
  ChatMobileShell: () => <div data-testid="chat-mobile-shell">Mobile Chat Shell</div>,
}));

vi.mock("@/features/agents", () => ({
  AgentsPage: () => <div>Agents</div>,
}));

vi.mock("@/shared/components/cron-config", () => ({
  CronConfig: () => <div>Cron</div>,
}));

vi.mock("@/features/marketplace", () => ({
  MarketplacePage: () => <div>Marketplace</div>,
}));

describe("ChatPageLayout", () => {
  it("uses the dedicated mobile chat shell instead of the desktop split layout", () => {
    useViewportLayoutMock.mockReturnValue({
      mode: "mobile",
      isMobile: true,
      isDesktop: false,
    });

    render(
      <ChatPageLayout
        view="chat"
        confirmDialog={<div data-testid="confirm-dialog">Confirm</div>}
      />,
    );

    expect(screen.getByTestId("chat-mobile-shell")).toBeTruthy();
    expect(screen.queryByTestId("desktop-chat-sidebar")).toBeNull();
    expect(screen.queryByTestId("chat-conversation-panel")).toBeNull();
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
  });
});
