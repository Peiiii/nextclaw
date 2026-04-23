import { useLocation, useNavigate } from "react-router-dom";
import { isChatSessionDetailRoute } from "@/app/configs/app-navigation.config";
import { ChatConversationPanel, ChatSidebar } from "@/features/chat";

export function ChatMobileShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isSessionDetailRoute = isChatSessionDetailRoute(pathname);

  if (isSessionDetailRoute) {
    return (
      <ChatConversationPanel
        layoutMode="mobile"
        onBackToList={() => navigate("/chat")}
      />
    );
  }

  return <ChatSidebar variant="mobile" />;
}
