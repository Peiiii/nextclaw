import { useStore } from "zustand";
import { useBiboChatStore } from "@/features/chat/stores/bibo-chat.store";
import { conversationView } from "@/features/chat/managers/bibo-conversation.manager";

/** React only subscribes; lifecycle and decisions belong to the manager. */
export function useBiboConversation() {
  const app = useBiboChatStore();
  const state = useStore(app.conversation.store);
  return { ...conversationView(state), messages: app.conversation.displayMessages(app.messages, app.activeSessionId) };
}
