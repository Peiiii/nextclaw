import {
  useEffect,
  useMemo,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ChatPageLayout,
  type ChatPageProps,
  useChatSessionSync,
} from "@/features/chat/components/layout/chat-page-shell";
import { parseSessionKeyFromRoute } from "@/features/chat/features/session/utils/chat-session-route.utils";
import { ChatPresenter } from "@/features/chat/presenters/chat.presenter";
import { useChatQueryStoreSync } from "@/features/chat/features/ncp/hooks/use-ncp-chat-query-store-sync";
import {
  ChatPresenterProvider,
  usePresenter,
} from "@/features/chat/components/providers/chat-presenter.provider";
import { useConfirmDialog } from "@/shared/hooks/use-confirm-dialog";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { useUiShowContentEvent } from "@/features/chat/features/ncp/hooks/use-ui-show-content-event";

function useNcpChatRouteSelection() {
  const { sessionId: routeSessionIdParam } = useParams<{ sessionId?: string }>();
  const routeSessionKey = useMemo(
    () => parseSessionKeyFromRoute(routeSessionIdParam),
    [routeSessionIdParam],
  );
  return {
    routeSessionKey,
    sessionKey: routeSessionKey ?? undefined,
  };
}

function useNcpChatUiBindings() {
  const presenter = usePresenter();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    presenter.chatUiManager.syncState({
      pathname: location.pathname,
    });
    presenter.chatUiManager.bindActions({
      navigate,
      confirm,
    });
  }, [confirm, location.pathname, navigate, presenter]);
  return <ConfirmDialog />;
}

export function NcpChatPage({ view }: ChatPageProps) {
  const appPresenter = useAppPresenter();
  const presenter = useMemo(() => new ChatPresenter(appPresenter), [appPresenter]);
  return (
    <ChatPresenterProvider presenter={presenter}>
      <NcpChatPageContent view={view} />
    </ChatPresenterProvider>
  );
}

function NcpChatPageContent({ view }: ChatPageProps) {
  const presenter = usePresenter();
  const confirmDialog = useNcpChatUiBindings();
  const routeSelection = useNcpChatRouteSelection();
  const { routeSessionKey, sessionKey } = routeSelection;
  useChatQueryStoreSync({
    sessionKey: sessionKey ?? null,
  });
  useChatSessionSync({
    view,
    routeSessionKey,
    syncRouteSessionSelection:
      presenter.chatSessionListManager.syncRouteSessionSelection,
  });
  useUiShowContentEvent();
  return <ChatPageLayout view={view} confirmDialog={confirmDialog} />;
}
