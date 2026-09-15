import { PageResourceActionsMenu } from '@/features/right-panel-resources';
import { pageResourceFromSystemObject } from '@/features/right-panel-resources';
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { useViewportLayout } from "@/app/hooks/use-viewport-layout";
import { buildSessionPath, CHAT_DRAFT_SESSION_PATH } from "@/features/chat";
import { InboxDeliveryContent } from "@/features/inbox/components/inbox-delivery-content";
import { useInboxDeliveries } from "@/features/inbox/hooks/use-inbox-deliveries";
import { useInboxStore } from "@/features/inbox/stores/inbox.store";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
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
  const { chatComposerIntentManager, docBrowserManager, inboxManager } = useAppPresenter();
  const { isMobile } = useViewportLayout();
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
      const { reference, targetSessionKey } = await inboxManager.prepareChatReference(activeDelivery.id);
      chatComposerIntentManager.requestSystemObjectReference({ targetSessionKey, reference });
      if (isMobile) docBrowserManager.close();
      navigate(targetSessionKey ? buildSessionPath(targetSessionKey) : CHAT_DRAFT_SESSION_PATH);
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
        <span className="hidden md:inline">{formatPosition(activeIndex + 1, unreadDeliveries.length)}</span>
        <span className="md:hidden" aria-label={formatPosition(activeIndex + 1, unreadDeliveries.length)}>{activeIndex + 1}/{unreadDeliveries.length}</span>
      </span>
      <IconActionButton
        size="sm"
        icon={<ChevronLeft className="h-4 w-4" />}
        label={t("inboxPrevious")}
        disabled={activeIndex <= 0 || pendingAction === "select"}
        onClick={() => selectAt(activeIndex - 1)}
      />
      <IconActionButton
        size="sm"
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
        className="flex h-[min(82vh,760px)] w-[calc(100vw-2rem)] max-w-[820px] flex-col gap-0 overflow-hidden rounded-[24px] border-border/70 bg-background p-0 shadow-[0_20px_55px_-22px_rgba(15,23,42,0.32)] max-md:h-[100dvh] max-md:max-h-[100dvh] max-md:w-screen max-md:max-w-none max-md:rounded-none max-md:border-0 max-md:pt-[env(safe-area-inset-top,0px)] max-md:pb-[env(safe-area-inset-bottom,0px)]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        {activeDelivery ? (
          <>
            <DialogHeader
              className="items-center gap-1 border-b border-border/50 px-3 py-2 md:gap-3 md:px-6 md:py-3"
              actions={<>
                {positionControls}
                <PageResourceActionsMenu page={pageResourceFromSystemObject("inbox-delivery", activeDelivery.id, activeDelivery.title)} />
              </>}
            >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground md:flex">
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
                  <span className="hidden shrink-0 text-muted-foreground md:inline" aria-hidden="true">·</span>
                  <time
                    className="hidden shrink-0 text-[11px] tabular-nums text-muted-foreground md:block"
                    dateTime={activeDelivery.createdAt}
                  >
                    {formatDateTime(activeDelivery.createdAt)}
                  </time>
                </div>
              <DialogDescription className="sr-only">
                {activeDelivery.summary ?? t("inboxNoSummary")}
              </DialogDescription>
            </DialogHeader>

            <div className={cn(
              "min-h-0 flex-1",
              isHtml
                ? "p-0 md:p-4"
                : "custom-scrollbar overflow-y-auto overscroll-contain px-4 py-3 md:px-8 md:py-6",
            )}>
              <InboxDeliveryContent
                className={isHtml ? "h-full" : undefined}
                content={activeDelivery.content}
                contentType={activeDelivery.contentType}
                fillHeight={isHtml}
                title={activeDelivery.title}
              />
            </div>

            <footer className="shrink-0 border-t border-border/50 bg-background px-3 py-2 md:px-6 md:py-3">
              {error ? (
                <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>
              ) : null}
              <div className="flex items-center justify-between gap-2 [--control-touch-size:2rem]">
                <div className="flex items-center gap-1">
                  <Button size="sm" className="px-2 md:px-3" variant="ghost" onClick={inboxManager.closeReader}>
                    {t("inboxReadLater")}
                  </Button>
                  <Button size="sm" className="px-2 md:px-3" variant="outline" disabled={pendingAction !== null} onClick={markRead}>
                    {t("inboxMarkRead")}
                  </Button>
                  <Button size="sm" className="px-2 md:px-3" variant="ghost" aria-label={t("inboxOpenInbox")} disabled={pendingAction !== null} onClick={openInbox}>
                    <span className="md:hidden">{t("inboxTitle")}</span>
                    <span className="hidden md:inline">{t("inboxOpenInbox")}</span>
                  </Button>
                </div>
                <Button size="sm" className="px-2 md:px-3" aria-label={t("inboxContinueChat")} disabled={pendingAction !== null} onClick={continueInChat}>
                  <span className="md:hidden">{t("inboxContinueChatCompact")}</span>
                  <span className="hidden md:inline">{t("inboxContinueChat")}</span>
                </Button>
              </div>
            </footer>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
