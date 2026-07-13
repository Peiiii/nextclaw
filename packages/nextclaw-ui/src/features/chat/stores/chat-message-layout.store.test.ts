import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CHAT_MESSAGE_LAYOUT,
  useChatMessageLayoutStore,
} from "@/features/chat/stores/chat-message-layout.store";

const STORAGE_KEY = "nextclaw.chat.message-layout";

describe("chat message layout store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useChatMessageLayoutStore.setState({
      layout: DEFAULT_CHAT_MESSAGE_LAYOUT,
    });
  });

  it("preserves an existing card layout preference", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { layout: "card" }, version: 1 }),
    );

    await useChatMessageLayoutStore.persist.rehydrate();
    expect(useChatMessageLayoutStore.getState().layout).toBe("card");
  });

  it("falls back to the flat layout for an invalid persisted layout", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { layout: "unknown" }, version: 1 }),
    );

    await useChatMessageLayoutStore.persist.rehydrate();

    expect(useChatMessageLayoutStore.getState().layout).toBe("flat");
  });
});
