import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
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

function formatPosition(current: number, total: number): string {
  return t("inboxReaderPosition")
    .replace("{current}", String(current))
    .replace("{total}", String(total));
}

export function InboxReaderDialog() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const navigate = useNavigate();
  const { inboxManager } = useAppPresenter();
  const { data } = useInboxDeliveries();
  const { activeDeliveryId, readerOpen } = useInboxStore((state) => state.snapshot);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unreadDeliveries = (data?.deliveries ?? []).filter(
    (delivery) => !delivery.readAt && !delivery.archivedAt,
  );
  const activeIndex = unreadDeliveries.findIndex(({ id }) => id === activeDeliveryId);
  const activeDelivery = activeIndex >= 0 ? unreadDeliveries[activeIndex] : null;

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
      const result = await inboxManager.continueInChat(activeDelivery.id);
      navigate(`/chat/${encodeURIComponent(result.sessionId)}`);
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
            <header className="shrink-0 border-b border-border/60 px-6 pb-4 pt-5 pr-14 sm:px-8 sm:pb-5 sm:pt-6">
              <div className="mb-5 flex min-h-8 items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Inbox className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate">{t("inboxDeliveredBy")}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={activeDelivery.createdAt}>
                    {formatDateTime(activeDelivery.createdAt)}
                  </time>
                </div>
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
              </div>
              <DialogTitle
                ref={titleRef}
                tabIndex={-1}
                className="max-w-[680px] text-balance text-2xl font-semibold leading-tight tracking-[-0.02em] outline-none sm:text-[28px]"
              >
                {activeDelivery.title}
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-[680px] text-sm leading-6 text-muted-foreground">
                {activeDelivery.summary ?? t("inboxNoSummary")}
              </DialogDescription>
            </header>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-7">
              <InboxDeliveryContent content={activeDelivery.content} />
            </div>

            <footer className="shrink-0 border-t border-border/60 bg-background/95 px-6 py-4 backdrop-blur sm:px-8">
              {error ? (
                <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <Button variant="ghost" onClick={inboxManager.closeReader}>
                    {t("inboxReadLater")}
                  </Button>
                  <Button variant="outline" disabled={pendingAction !== null} onClick={markRead}>
                    {t("inboxMarkRead")}
                  </Button>
                  <Button variant="outline" disabled={pendingAction !== null} onClick={openInbox}>
                    {t("inboxOpenInbox")}
                  </Button>
                </div>
                <Button disabled={pendingAction !== null} onClick={continueInChat}>
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
