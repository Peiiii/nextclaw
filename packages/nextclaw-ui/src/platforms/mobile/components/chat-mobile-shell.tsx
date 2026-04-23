import { useLocation } from "react-router-dom";
import { isChatSessionDetailRoute } from "@/app/configs/app-navigation.config";
import { ChatConversationPanel, ChatSidebar } from "@/features/chat";

export function ChatMobileShell() {
  const { pathname } = useLocation();
  const isSessionDetailRoute = isChatSessionDetailRoute(pathname);

  if (isSessionDetailRoute) {
    return <ChatConversationPanel layoutMode="mobile" />;
  }

  return <ChatSidebar variant="mobile" />;
}
