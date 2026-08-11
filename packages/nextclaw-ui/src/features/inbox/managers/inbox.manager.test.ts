import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InboxDelivery } from "@nextclaw/shared";
import { InboxManager } from "@/features/inbox/managers/inbox.manager";
import { useInboxStore } from "@/features/inbox/stores/inbox.store";

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
  resolveReference: vi.fn(),
  list: vi.fn(),
  on: vi.fn(() => vi.fn()),
  updateState: vi.fn(),
}));

vi.mock("@/shared/lib/api", () => ({
  nextclawClient: {
    eventBus: { on: mocks.on },
    inboxDeliveries: {
      delete: mocks.delete,
      list: mocks.list,
      updateState: mocks.updateState,
    },
    systemObjectReferences: {
      resolve: mocks.resolveReference,
    },
  },
}));

const delivery: InboxDelivery = {
  id: "delivery-1",
  title: "Brief",
  summary: null,
  content: "# Brief",
  contentType: "markdown",
  source: { kind: "agent", agentId: null, sessionId: null, toolCallId: null, filePath: null },
  createdAt: "2026-08-06T00:00:00.000Z",
  updatedAt: "2026-08-06T00:00:00.000Z",
  presentedAt: null,
  readAt: null,
  archivedAt: null,
};

describe("InboxManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    useInboxStore.setState({
      snapshot: { readerOpen: false, activeDeliveryId: null },
    });
    mocks.list.mockResolvedValue({
      deliveries: [delivery],
      total: 1,
      unreadCount: 1,
      unpresentedCount: 1,
    });
    mocks.updateState.mockImplementation(async (_id: string, action: string) => ({
      ...delivery,
      presentedAt: action === "present" || action === "read" ? "2026-08-06T01:00:00.000Z" : null,
      readAt: action === "read" ? "2026-08-06T01:00:00.000Z" : null,
    }));
    mocks.resolveReference.mockResolvedValue({
      uri: "nextclaw://objects/inbox-delivery/delivery-1",
      objectType: "inbox-delivery",
      objectId: "delivery-1",
      label: "Brief",
      description: null,
      updatedAt: delivery.updatedAt,
      version: "version-1",
      assetUri: "asset://store/report",
      fileName: "brief.md",
      mimeType: "text/markdown",
      sizeBytes: 7,
    });
  });

  it("auto-opens the oldest unpresented item and only marks it presented", async () => {
    const manager = new InboxManager(new QueryClient());
    manager.start();

    await vi.waitFor(() => {
      expect(useInboxStore.getState().snapshot).toEqual({
        readerOpen: true,
        activeDeliveryId: "delivery-1",
      });
    });
    expect(mocks.updateState).toHaveBeenCalledWith("delivery-1", "present");
    expect(mocks.updateState).not.toHaveBeenCalledWith("delivery-1", "read");
    manager.stop();
  });

  it("closes the reader without changing unread state or reopening it", async () => {
    const manager = new InboxManager(new QueryClient());
    await manager.selectInReader(delivery.id);
    manager.closeReader();

    expect(useInboxStore.getState().snapshot.readerOpen).toBe(false);
    expect(mocks.updateState).toHaveBeenCalledTimes(1);
    expect(mocks.updateState).toHaveBeenCalledWith(delivery.id, "present");
  });

  it("prepares a generic immutable report reference before marking it read", async () => {
    const manager = new InboxManager(new QueryClient());
    const result = await manager.prepareChatReference(delivery.id);

    expect(mocks.resolveReference).toHaveBeenCalledWith(
      "nextclaw://objects/inbox-delivery/delivery-1",
    );
    expect(mocks.updateState).toHaveBeenCalledWith(delivery.id, "read");
    expect(result.reference.assetUri).toBe("asset://store/report");
  });
});
