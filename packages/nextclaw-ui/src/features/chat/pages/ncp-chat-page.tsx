import { useParams } from "react-router-dom";
import {
  ChatPageLayout,
  type ChatPageProps,
  useChatSessionSync,
} from "@/features/chat/components/layout/chat-page-shell";
import { parseSessionKeyFromRoute } from "@/features/chat/features/session/utils/chat-session-route.utils";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import { useUiShowContentEvent } from "@/features/chat/features/ncp/hooks/use-ui-show-content-event";

export function NcpChatPage({ view }: ChatPageProps) {
  const presenter = usePresenter();
  const { sessionId } = useParams<{ sessionId?: string }>();
  useChatSessionSync({
    routeSessionKey: parseSessionKeyFromRoute(sessionId),
    syncRouteSessionSelection: presenter.chatSessionListManager.syncRouteSessionSelection,
  });
  useUiShowContentEvent();
  return <ChatPageLayout view={view} />;
}
