import type { ChatThreadSnapshot } from "@/features/chat/stores/chat-thread.store";

type ChatWelcomeVisibilitySnapshot = Pick<
  ChatThreadSnapshot,
  "canDeleteSession" | "hasSubmittedDraftMessage" | "isSending" | "messages"
>;

export function shouldShowChatWelcome(
  snapshot: ChatWelcomeVisibilitySnapshot,
): boolean {
  return (
    !snapshot.canDeleteSession &&
    !snapshot.hasSubmittedDraftMessage &&
    snapshot.messages.length === 0 &&
    !snapshot.isSending
  );
}
