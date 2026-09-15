import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSessionPath, CHAT_DRAFT_SESSION_PATH } from "@/features/chat";
import { InboxReaderDialog } from "@/features/inbox/components/inbox-reader-dialog";
import { useInboxStore } from "@/features/inbox/stores/inbox.store";
import { t } from "@/shared/lib/i18n";

const mocks = vi.hoisted(() => ({
  closeReader: vi.fn(),
  contentType: "markdown",
  deliveryCount: 1,
  prepareChatReference: vi.fn(),
  requestSystemObjectReference: vi.fn(),
  markRead: vi.fn(),
  selectInReader: vi.fn(),
}));

vi.mock("@/app/components/app-presenter-provider", () => ({
  useAppPresenter: () => ({
    docBrowserManager: { close: vi.fn() },
    inboxManager: mocks,
    chatComposerIntentManager: { requestSystemObjectReference: mocks.requestSystemObjectReference },
  }),
}));

vi.mock("@/features/inbox/hooks/use-inbox-deliveries", () => ({
  useInboxDeliveries: () => ({
    data: {
      deliveries: Array.from({ length: mocks.deliveryCount }, (_, index) => ({
        id: `delivery-${index + 1}`,
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
      })),
    },
  }),
}));

vi.mock("@nextclaw/agent-chat-ui", () => ({
  ChatMessageMarkdown: ({ text }: { text: string }) => (
    <article>{text.replace(/[*#]/g, "").trim()}</article>
  ),
}));

function CurrentPath() {
  return <span data-testid="current-path">{useLocation().pathname}</span>;
}

describe("InboxReaderDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.contentType = "markdown";
    mocks.deliveryCount = 1;
    mocks.prepareChatReference.mockResolvedValue({
      targetSessionKey: null,
      reference: {
        uri: "nextclaw://objects/inbox-delivery/delivery-1",
        label: "A considered report",
      },
    });
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

  it("opens a draft with a visible system object reference intent", async () => {
    render(
      <MemoryRouter initialEntries={["/inbox"]}>
        <InboxReaderDialog />
        <CurrentPath />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: t("inboxContinueChat") }));

    await waitFor(() => {
      expect(screen.getByTestId("current-path").textContent).toBe(CHAT_DRAFT_SESSION_PATH);
    });
    expect(mocks.prepareChatReference).toHaveBeenCalledWith("delivery-1");
    expect(mocks.requestSystemObjectReference).toHaveBeenCalledWith(
      { targetSessionKey: null, reference: expect.objectContaining({ uri: "nextclaw://objects/inbox-delivery/delivery-1" }) },
    );
  });

  it("keeps every reader action accessible and opens the current report in Inbox", async () => {
    render(<MemoryRouter><InboxReaderDialog /><CurrentPath /></MemoryRouter>);
    for (const key of ["inboxReadLater", "inboxMarkRead", "inboxOpenInbox", "inboxContinueChat"] as const) {
      expect(screen.getByRole("button", { name: t(key) })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole("button", { name: t("inboxOpenInbox") }));
    await waitFor(() => expect(screen.getByTestId("current-path").textContent).toBe("/inbox/delivery-1"));
    expect(mocks.markRead).toHaveBeenCalledWith("delivery-1");
    expect(mocks.closeReader).toHaveBeenCalled();
  });

  it("returns to the report source instead of consuming the reference in the current session", async () => {
    const reference = { uri: "nextclaw://objects/inbox-delivery/delivery-1", label: "A considered report" };
    mocks.prepareChatReference.mockResolvedValue({ reference, targetSessionKey: "source-session" });
    render(<MemoryRouter initialEntries={[buildSessionPath("other-session")]}><InboxReaderDialog /><CurrentPath /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: t("inboxContinueChat") }));
    await waitFor(() => expect(screen.getByTestId("current-path").textContent).toBe(buildSessionPath("source-session")));
    expect(mocks.requestSystemObjectReference).toHaveBeenCalledWith({ targetSessionKey: "source-session", reference });
  });

  it("closes through the shared icon action", () => {
    render(<MemoryRouter><InboxReaderDialog /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: t("close") }));
    expect(mocks.closeReader).toHaveBeenCalledOnce();
  });

  it("navigates multiple reports without triggering the adjacent close action", async () => {
    mocks.deliveryCount = 2;
    render(<MemoryRouter><InboxReaderDialog /></MemoryRouter>);
    expect((screen.getByRole("button", { name: t("inboxPrevious") }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: t("inboxNext") }));
    await waitFor(() => expect(mocks.selectInReader).toHaveBeenCalledWith("delivery-2"));
    expect(mocks.closeReader).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: t("close") })).toHaveLength(1);
  });
});

// Resource policy has separate integration coverage; keep this fixture scoped to its business UI.
vi.mock("@/features/right-panel-resources/hooks/use-page-resource-actions", () => ({ usePageResourceActions: () => () => [] }));
