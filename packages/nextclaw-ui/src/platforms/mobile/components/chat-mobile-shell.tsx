import { useLocation } from "react-router-dom";
import { ChatConversationPanel, ChatSidebar } from "@/features/chat";

export function ChatMobileShell() {
  const { pathname } = useLocation();
  const normalizedPath = pathname.toLowerCase();
  const isSessionDetailRoute =
    normalizedPath.startsWith("/chat/") && normalizedPath !== "/chat";

  if (isSessionDetailRoute) {
    return <ChatConversationPanel layoutMode="mobile" />;
  }

  return <ChatSidebar variant="mobile" />;
}
