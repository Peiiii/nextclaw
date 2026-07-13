import type { ChatMessageLayout } from "@nextclaw/agent-chat-ui";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const CHAT_MESSAGE_LAYOUT_STORAGE_KEY = "nextclaw.chat.message-layout";
const CHAT_MESSAGE_LAYOUT_STORAGE_VERSION = 1;
export const DEFAULT_CHAT_MESSAGE_LAYOUT: ChatMessageLayout = "flat";

type ChatMessageLayoutStore = {
  layout: ChatMessageLayout;
  setLayout: (layout: ChatMessageLayout) => void;
};

function resolvePersistedLayout(persistedState: unknown): ChatMessageLayout {
  if (!persistedState || typeof persistedState !== "object") {
    return DEFAULT_CHAT_MESSAGE_LAYOUT;
  }
  const { layout } = persistedState as { layout?: unknown };
  return layout === "flat" || layout === "card"
    ? layout
    : DEFAULT_CHAT_MESSAGE_LAYOUT;
}

export const useChatMessageLayoutStore = create<ChatMessageLayoutStore>()(
  persist(
    (set) => ({
      layout: DEFAULT_CHAT_MESSAGE_LAYOUT,
      setLayout: (layout) => set({ layout }),
    }),
    {
      name: CHAT_MESSAGE_LAYOUT_STORAGE_KEY,
      version: CHAT_MESSAGE_LAYOUT_STORAGE_VERSION,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({ layout: state.layout }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        layout: resolvePersistedLayout(persistedState),
      }),
    },
  ),
);
