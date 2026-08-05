import { describe, expect, it } from "vitest";
import { resolveInboxFilter } from "@/features/inbox/pages/inbox-page";

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
