import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { CHAT_DRAFT_SESSION_PATH } from "@/features/chat";
import { InboxDeliveryContent } from "@/features/inbox/components/inbox-delivery-content";
import { useInboxDeliveries } from "@/features/inbox/hooks/use-inbox-deliveries";
import { useInboxStore } from "@/features/inbox/stores/inbox.store";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import { formatDateTime, t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

function formatPosition(current: number, total: number): string {
  return t("inboxReaderPosition")
    .replace("{current}", String(current))
    .replace("{total}", String(total));
}

export function InboxReaderDialog() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const navigate = useNavigate();
  const { chatDraftIntentManager, inboxManager } = useAppPresenter();
  const { data } = useInboxDeliveries();
  const { activeDeliveryId, readerOpen } = useInboxStore((state) => state.snapshot);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unreadDeliveries = (data?.deliveries ?? []).filter(
    (delivery) => !delivery.readAt && !delivery.archivedAt,
  );
  const activeIndex = unreadDeliveries.findIndex(({ id }) => id === activeDeliveryId);
  const activeDelivery = activeIndex >= 0 ? unreadDeliveries[activeIndex] : null;
  const isHtml = activeDelivery?.contentType === "html";

  const runAction = async (name: string, action: () => Promise<void>) => {
    setPendingAction(name);
    setError(null);
    try {
      await action();
    } catch {
      setError(t("inboxActionError"));
    } finally {
      setPendingAction(null);
    }
  };

  const selectAt = (index: number) => {
    const delivery = unreadDeliveries[index];
    if (delivery) {
      void runAction("select", async () => {
        await inboxManager.selectInReader(delivery.id);
      });
    }
  };

  const openInbox = () => {
    if (!activeDelivery) {
      return;
    }
    void runAction("open", async () => {
      await inboxManager.markRead(activeDelivery.id);
      inboxManager.closeReader();
      navigate(`/inbox/${encodeURIComponent(activeDelivery.id)}`);
    });
  };

  const continueInChat = () => {
    if (!activeDelivery) {
      return;
    }
    void runAction("continue", async () => {
      const { reference } = await inboxManager.prepareChatReference(activeDelivery.id);
      chatDraftIntentManager.requestSystemObjectReference(reference);
      navigate(CHAT_DRAFT_SESSION_PATH);
    });
  };

  const markRead = () => {
    if (!activeDelivery) {
      return;
    }
    void runAction("read", async () => {
      await inboxManager.markRead(activeDelivery.id);
      inboxManager.closeReader();
    });
  };

  const positionControls = unreadDeliveries.length > 1 ? (
    <div className="flex shrink-0 items-center gap-1 pr-1">
      <span className="mr-1 text-[11px] tabular-nums text-muted-foreground">
        {formatPosition(activeIndex + 1, unreadDeliveries.length)}
      </span>
      <IconActionButton
        icon={<ChevronLeft className="h-4 w-4" />}
        label={t("inboxPrevious")}
        disabled={activeIndex <= 0 || pendingAction === "select"}
        onClick={() => selectAt(activeIndex - 1)}
      />
      <IconActionButton
        icon={<ChevronRight className="h-4 w-4" />}
        label={t("inboxNext")}
        disabled={activeIndex >= unreadDeliveries.length - 1 || pendingAction === "select"}
        onClick={() => selectAt(activeIndex + 1)}
      />
    </div>
  ) : null;

  return (
    <Dialog
      open={readerOpen && Boolean(activeDelivery)}
      onOpenChange={(open) => {
        if (!open) {
          inboxManager.closeReader();
        }
      }}
    >
      <DialogContent
        className="flex h-[min(82vh,760px)] w-[calc(100vw-2rem)] max-w-[820px] flex-col gap-0 overflow-hidden rounded-[24px] border-border/70 bg-background p-0 shadow-[0_20px_55px_-22px_rgba(15,23,42,0.32)] max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-screen max-sm:rounded-none max-sm:border-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        {activeDelivery ? (
          <>
            <header className="shrink-0 border-b border-border/50 px-5 py-3 pr-14 sm:px-6">
              <div className="flex min-h-7 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
                    <Inbox className="h-3.5 w-3.5" />
                  </span>
                  <DialogTitle
                    ref={titleRef}
                    tabIndex={-1}
                    title={activeDelivery.title}
                    className="min-w-0 truncate text-sm font-medium text-foreground outline-none"
                  >
                    {activeDelivery.title}
                  </DialogTitle>
                  <span className="hidden shrink-0 text-muted-foreground sm:inline" aria-hidden="true">·</span>
                  <time
                    className="hidden shrink-0 text-[11px] tabular-nums text-muted-foreground sm:block"
                    dateTime={activeDelivery.createdAt}
                  >
                    {formatDateTime(activeDelivery.createdAt)}
                  </time>
                </div>
                {positionControls}
              </div>
              <DialogDescription className="sr-only">
                {activeDelivery.summary ?? t("inboxNoSummary")}
              </DialogDescription>
            </header>

            <div className={cn(
              "min-h-0 flex-1",
              isHtml
                ? "p-3 sm:p-4"
                : "custom-scrollbar overflow-y-auto px-6 py-5 sm:px-8 sm:py-6",
            )}>
              <InboxDeliveryContent
                className={isHtml ? "h-full" : undefined}
                content={activeDelivery.content}
                contentType={activeDelivery.contentType}
                fillHeight={isHtml}
                title={activeDelivery.title}
              />
            </div>

            <footer className="shrink-0 border-t border-border/50 bg-background px-5 py-3 sm:px-6">
              {error ? (
                <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col-reverse gap-1 sm:flex-row sm:flex-wrap">
                  <Button size="sm" variant="ghost" onClick={inboxManager.closeReader}>
                    {t("inboxReadLater")}
                  </Button>
                  <Button size="sm" variant="outline" disabled={pendingAction !== null} onClick={markRead}>
                    {t("inboxMarkRead")}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={pendingAction !== null} onClick={openInbox}>
                    {t("inboxOpenInbox")}
                  </Button>
                </div>
                <Button size="sm" disabled={pendingAction !== null} onClick={continueInChat}>
                  {t("inboxContinueChat")}
                </Button>
              </div>
            </footer>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
