import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InboxReaderDialog } from "@/features/inbox/components/inbox-reader-dialog";
import { useInboxStore } from "@/features/inbox/stores/inbox.store";
import { t } from "@/shared/lib/i18n";

const mocks = vi.hoisted(() => ({
  closeReader: vi.fn(),
  contentType: "markdown",
  continueInChat: vi.fn(),
  markRead: vi.fn(),
  selectInReader: vi.fn(),
}));

vi.mock("@/app/components/app-presenter-provider", () => ({
  useAppPresenter: () => ({ inboxManager: mocks }),
}));

vi.mock("@/features/inbox/hooks/use-inbox-deliveries", () => ({
  useInboxDeliveries: () => ({
    data: {
      deliveries: [{
        id: "delivery-1",
        title: "A considered report",
        summary: "A concise summary",
        content: mocks.contentType === "html"
          ? "<h1>HTML finding</h1>"
          : "# Finding\n\n**Important** result",
        contentType: mocks.contentType,
        source: { kind: "agent", agentId: null, sessionId: null, toolCallId: null, filePath: null },
        createdAt: "2026-08-06T00:00:00.000Z",
        updatedAt: "2026-08-06T00:00:00.000Z",
        presentedAt: "2026-08-06T00:01:00.000Z",
        readAt: null,
        archivedAt: null,
        conversationSessionId: null,
      }],
    },
  }),
}));

vi.mock("@nextclaw/agent-chat-ui", () => ({
  ChatMessageMarkdown: ({ text }: { text: string }) => (
    <article>{text.replace(/[*#]/g, "").trim()}</article>
  ),
}));

describe("InboxReaderDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.contentType = "markdown";
    useInboxStore.setState({
      snapshot: { readerOpen: true, activeDeliveryId: "delivery-1" },
    });
  });

  it("renders one accessible compact reader with friendly Markdown output", () => {
    render(<MemoryRouter><InboxReaderDialog /></MemoryRouter>);

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    const title = screen.getByRole("heading", { name: "A considered report" });
    expect(title.className).toContain("text-sm");
    expect(document.activeElement).toBe(title);
    expect(screen.getByText("A concise summary").className).toContain("sr-only");
    expect(screen.getByText(/Important result/)).toBeTruthy();
    expect(screen.queryByText("**Important** result")).toBeNull();
    expect(screen.queryByRole("button", { name: t("inboxPrevious") })).toBeNull();
    expect(screen.queryByRole("button", { name: t("inboxNext") })).toBeNull();
  });

  it("lets HTML fill the reading area without changing the compact chrome", () => {
    mocks.contentType = "html";
    render(<MemoryRouter><InboxReaderDialog /></MemoryRouter>);

    const title = screen.getByRole("heading", { name: "A considered report" });
    expect(title.className).toContain("text-sm");
    expect(screen.getByText("A concise summary").className).toContain("sr-only");
    const htmlPreview = screen.getAllByTitle("A considered report")
      .find((element) => element.tagName === "IFRAME");
    expect(htmlPreview?.className).toContain("h-full");
  });
});
