import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ChatThread } from '@/components/chat/ChatThread';
import { ChatWelcome } from '@/components/chat/ChatWelcome';
import { ChatInputBarView } from '@/components/chat/chat-input/ChatInputBarView';
import { usePresenter } from '@/components/chat/presenter/chat-presenter-context';
import { useChatThreadStore } from '@/components/chat/stores/chat-thread.store';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';

const STICKY_BOTTOM_THRESHOLD_PX = 10;

function ChatConversationSkeleton() {
  return (
    <section className="flex-1 min-h-0 flex flex-col overflow-hidden bg-gradient-to-b from-gray-50/60 to-white">
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="mx-auto w-full max-w-[min(1120px,100%)] px-6 py-5">
          <div className="space-y-4">
            <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
            <div className="h-24 w-[78%] animate-pulse rounded-2xl bg-gray-200/80" />
            <div className="h-20 w-[62%] animate-pulse rounded-2xl bg-gray-200/80" />
            <div className="h-28 w-[84%] animate-pulse rounded-2xl bg-gray-200/80" />
          </div>
        </div>
      </div>
      <div className="border-t border-gray-200/80 bg-white p-4">
        <div className="mx-auto w-full max-w-[min(1120px,100%)]">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-card p-4">
            <div className="h-16 w-full animate-pulse rounded-xl bg-gray-200/80" />
            <div className="mt-3 flex items-center justify-between">
              <div className="h-8 w-36 animate-pulse rounded-lg bg-gray-200/80" />
              <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-200/80" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ChatConversationPanel() {
  const presenter = usePresenter();
  const snapshot = useChatThreadStore((state) => state.snapshot);
  const fallbackThreadRef = useRef<HTMLDivElement | null>(null);
  const threadRef = snapshot.threadRef ?? fallbackThreadRef;

  // --- Sticky-to-bottom scroll state ---
  const isStickyRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);
  const previousSessionKeyRef = useRef<string | null>(null);
  const pendingInitialScrollRef = useRef(false);

  const showWelcome = !snapshot.selectedSessionKey && snapshot.uiMessages.length === 0 && !snapshot.isSending;
  const hasConfiguredModel = snapshot.modelOptions.length > 0;
  const shouldShowProviderHint = snapshot.isProviderStateResolved && !hasConfiguredModel;
  const hideEmptyHint =
    snapshot.isHistoryLoading &&
    snapshot.uiMessages.length === 0 &&
    !snapshot.isSending &&
    !snapshot.isAwaitingAssistantOutput;

  const scrollToBottom = useCallback(() => {
    const el = threadRef.current;
    if (!el) return;
    isProgrammaticScrollRef.current = true;
    el.scrollTop = el.scrollHeight;
  }, [threadRef]);

  const handleScroll = useCallback(() => {
    // Skip sticky check for programmatic scrolls
    if (isProgrammaticScrollRef.current) {
      isProgrammaticScrollRef.current = false;
      return;
    }
    const el = threadRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isStickyRef.current = distanceFromBottom <= STICKY_BOTTOM_THRESHOLD_PX;
  }, [threadRef]);

  // Session change → force sticky + schedule initial scroll
  useEffect(() => {
    if (previousSessionKeyRef.current === snapshot.selectedSessionKey) return;
    previousSessionKeyRef.current = snapshot.selectedSessionKey;
    isStickyRef.current = true;
    pendingInitialScrollRef.current = true;
  }, [snapshot.selectedSessionKey]);

  // Initial scroll after history loads for a new session
  useLayoutEffect(() => {
    if (!pendingInitialScrollRef.current) return;
    if (snapshot.isHistoryLoading || snapshot.uiMessages.length === 0) return;
    pendingInitialScrollRef.current = false;
    scrollToBottom();
  }, [scrollToBottom, snapshot.isHistoryLoading, snapshot.uiMessages]);

  // Streaming updates: keep bottom visible while still sticky.
  useLayoutEffect(() => {
    if (!isStickyRef.current) return;
    if (snapshot.uiMessages.length === 0) return;
    scrollToBottom();
  }, [scrollToBottom, snapshot.uiMessages]);

  if (!snapshot.isProviderStateResolved) {
    return <ChatConversationSkeleton />;
  }

  return (
    <section className="flex-1 min-h-0 flex flex-col overflow-hidden bg-gradient-to-b from-gray-50/60 to-white">
      <div className={cn(
        "px-5 border-b border-gray-200/60 bg-white/80 backdrop-blur-sm flex items-center justify-between shrink-0 overflow-hidden transition-all duration-200",
        snapshot.selectedSessionKey ? "py-3 opacity-100" : "h-0 py-0 opacity-0 border-b-0"
      )}>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-gray-700 truncate">
            {snapshot.sessionDisplayName || snapshot.selectedSessionKey}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-lg shrink-0 text-gray-400 hover:text-destructive"
          onClick={presenter.chatThreadManager.deleteSession}
          disabled={!snapshot.canDeleteSession || snapshot.isDeletePending}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {shouldShowProviderHint && (
        <div className="px-5 py-2.5 border-b border-amber-200/70 bg-amber-50/70 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-amber-800">{t('chatModelNoOptions')}</span>
          <button
            type="button"
            onClick={presenter.chatThreadManager.goToProviders}
            className="text-xs font-semibold text-amber-900 underline-offset-2 hover:underline"
          >
            {t('chatGoConfigureProvider')}
          </button>
        </div>
      )}

      {snapshot.sessionTypeUnavailable && snapshot.sessionTypeUnavailableMessage?.trim() && (
        <div className="px-5 py-2.5 border-b border-amber-200/70 bg-amber-50/70 shrink-0">
          <span className="text-xs text-amber-800">{snapshot.sessionTypeUnavailableMessage}</span>
        </div>
      )}

      <div
        ref={threadRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto custom-scrollbar"
      >
        {showWelcome ? (
          <ChatWelcome onCreateSession={presenter.chatThreadManager.createSession} />
        ) : hideEmptyHint ? (
          <div className="h-full" />
        ) : snapshot.uiMessages.length === 0 ? (
          <div className="px-5 py-5 text-sm text-gray-500">{t('chatNoMessages')}</div>
        ) : (
          <div className="mx-auto w-full max-w-[min(1120px,100%)] px-6 py-5">
            <ChatThread uiMessages={snapshot.uiMessages} isSending={snapshot.isSending && snapshot.isAwaitingAssistantOutput} />
          </div>
        )}
      </div>

      <ChatInputBarView />
    </section>
  );
}
