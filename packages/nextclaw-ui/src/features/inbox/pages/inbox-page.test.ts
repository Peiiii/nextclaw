import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CHAT_DRAFT_SESSION_PATH } from "@/features/chat";
import { InboxPage, resolveInboxFilter } from "@/features/inbox/pages/inbox-page";
import { t } from "@/shared/lib/i18n";

const mocks = vi.hoisted(() => ({
  prepareChatReference: vi.fn(),
  requestSystemObjectReference: vi.fn(),
}));

vi.mock("@/app/components/app-presenter-provider", () => ({
  useAppPresenter: () => ({
    chatDraftIntentManager: {
      requestSystemObjectReference: mocks.requestSystemObjectReference,
    },
    inboxManager: {
      archive: vi.fn(),
      delete: vi.fn(),
      markRead: vi.fn(),
      markUnread: vi.fn(),
      prepareChatReference: mocks.prepareChatReference,
      restore: vi.fn(),
    },
  }),
}));

vi.mock("@/app/hooks/use-viewport-layout", () => ({
  useViewportLayout: () => ({ isMobile: false }),
}));

vi.mock("@/features/inbox/hooks/use-inbox-deliveries", () => ({
  useInboxDeliveries: () => ({
    data: {
      deliveries: [{
        id: "delivery-1",
        title: "A considered report",
        summary: "A concise summary",
        content: "# Finding",
        contentType: "markdown",
        source: { kind: "agent", agentId: null, sessionId: null, toolCallId: null, filePath: null },
        createdAt: "2026-08-06T00:00:00.000Z",
        updatedAt: "2026-08-06T00:00:00.000Z",
        presentedAt: "2026-08-06T00:01:00.000Z",
        readAt: "2026-08-06T00:02:00.000Z",
        archivedAt: null,
      }],
    },
    isError: false,
  }),
}));

vi.mock("@/features/inbox/components/inbox-delivery-content", () => ({
  InboxDeliveryContent: ({ content }: { content: string }) =>
    createElement("article", null, content),
}));

vi.mock("@/shared/hooks/use-confirm-dialog", () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn(async () => true),
    ConfirmDialog: () => null,
  }),
}));

function CurrentPath() {
  return createElement(
    "span",
    { "data-testid": "current-path" },
    useLocation().pathname,
  );
}

const readDelivery = {
  archivedAt: null,
  readAt: "2026-08-06T08:30:00.000Z",
};
const unreadDelivery = {
  archivedAt: null,
  readAt: null,
};

describe("resolveInboxFilter", () => {
  it("defaults to all when there is no unread delivery", () => {
    expect(resolveInboxFilter([], null)).toBe("all");
    expect(resolveInboxFilter([readDelivery], null)).toBe("all");
    expect(resolveInboxFilter([{ ...unreadDelivery, archivedAt: readDelivery.readAt }], null))
      .toBe("all");
  });

  it("defaults to unread when actionable unread deliveries exist", () => {
    expect(resolveInboxFilter([readDelivery, unreadDelivery], null)).toBe("unread");
  });

  it("preserves the user's explicit filter", () => {
    expect(resolveInboxFilter([unreadDelivery], "archived")).toBe("archived");
  });
});

describe("InboxPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prepareChatReference.mockResolvedValue({
      reference: {
        uri: "nextclaw://objects/inbox-delivery/delivery-1",
        label: "A considered report",
      },
    });
  });

  it("opens a draft with the same visible system object intent as the reader dialog", async () => {
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/inbox/delivery-1"] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: "/inbox/:deliveryId",
            element: createElement(
              "div",
              null,
              createElement(InboxPage),
              createElement(CurrentPath),
            ),
          }),
          createElement(Route, {
            path: "*",
            element: createElement(CurrentPath),
          }),
        ),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: t("inboxContinueChat") }));

    await waitFor(() => {
      expect(screen.getByTestId("current-path").textContent).toBe(CHAT_DRAFT_SESSION_PATH);
    });
    expect(mocks.prepareChatReference).toHaveBeenCalledWith("delivery-1");
    expect(mocks.requestSystemObjectReference).toHaveBeenCalledWith(
      expect.objectContaining({ uri: "nextclaw://objects/inbox-delivery/delivery-1" }),
    );
  });
});
