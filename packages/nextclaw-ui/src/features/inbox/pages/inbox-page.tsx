import { useEffect, useMemo, useState } from "react";
import type { InboxDelivery } from "@nextclaw/shared";
import { Archive, ArrowLeft, Inbox, MessageCircle, RotateCcw, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { useViewportLayout } from "@/app/hooks/use-viewport-layout";
import { InboxDeliveryContent } from "@/features/inbox/components/inbox-delivery-content";
import { useInboxDeliveries } from "@/features/inbox/hooks/use-inbox-deliveries";
import { Button } from "@/shared/components/ui/button";
import { useConfirmDialog } from "@/shared/hooks/use-confirm-dialog";
import { formatDateTime, t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

type InboxFilter = "unread" | "all" | "archived";

function filterDeliveries(deliveries: InboxDelivery[], filter: InboxFilter): InboxDelivery[] {
  if (filter === "unread") {
    return deliveries.filter((delivery) => !delivery.readAt && !delivery.archivedAt);
  }
  if (filter === "archived") {
    return deliveries.filter((delivery) => Boolean(delivery.archivedAt));
  }
  return deliveries.filter((delivery) => !delivery.archivedAt);
}

function InboxEmptyState({ selection = false }: { selection?: boolean }) {
  return (
    <div className="flex h-full min-h-56 flex-col items-center justify-center px-8 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Inbox className="h-5 w-5" />
      </span>
      <h2 className="text-base font-semibold text-foreground">
        {t(selection ? "inboxSelectTitle" : "inboxEmptyTitle")}
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        {t(selection ? "inboxSelectDescription" : "inboxEmptyDescription")}
      </p>
    </div>
  );
}

function InboxPageHeader({ unreadCount }: { unreadCount: number }) {
  return (
    <header className="shrink-0 px-4 pb-4 pt-1 sm:px-0">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {t("inboxTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("inboxDescription")}</p>
        </div>
        {unreadCount > 0 ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {t("inboxUnreadCount").replace("{count}", String(unreadCount))}
          </span>
        ) : null}
      </div>
    </header>
  );
}

function InboxListPane({
  activeDeliveryId,
  deliveries,
  filter,
  onFilterChange,
}: {
  activeDeliveryId: string | null;
  deliveries: InboxDelivery[];
  filter: InboxFilter;
  onFilterChange: (filter: InboxFilter) => void;
}) {
  const filterItems: Array<{ id: InboxFilter; label: string }> = [
    { id: "unread", label: t("inboxUnread") },
    { id: "all", label: t("inboxAll") },
    { id: "archived", label: t("inboxArchived") },
  ];
  const filteredDeliveries = filterDeliveries(deliveries, filter);
  return (
    <aside className="flex min-h-0 flex-col border-border/60 md:border-r">
      <div className="flex shrink-0 gap-1 border-b border-border/60 p-3">
        {filterItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onFilterChange(item.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border",
              filter === item.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
        {filteredDeliveries.length > 0 ? (
          <ul className="space-y-1">
            {filteredDeliveries.map((delivery) => (
              <li key={delivery.id}>
                <Link
                  to={`/inbox/${encodeURIComponent(delivery.id)}`}
                  className={cn(
                    "block rounded-xl px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border",
                    activeDeliveryId === delivery.id ? "bg-muted" : "hover:bg-muted/70",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        !delivery.readAt && "bg-primary",
                      )}
                      aria-label={!delivery.readAt ? t("inboxUnread") : undefined}
                      aria-hidden={delivery.readAt ? "true" : undefined}
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className={cn(
                        "line-clamp-2 text-sm leading-5 text-foreground",
                        !delivery.readAt && "font-semibold",
                      )}>
                        {delivery.title}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {delivery.summary ?? t("inboxNoSummary")}
                      </p>
                      <time
                        className="mt-2 block text-[11px] text-muted-foreground/80"
                        dateTime={delivery.createdAt}
                      >
                        {formatDateTime(delivery.createdAt)}
                      </time>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : <InboxEmptyState />}
      </div>
    </aside>
  );
}

function InboxDetailPane({
  delivery,
  error,
  isMobile,
  pending,
  onArchiveToggle,
  onBack,
  onContinue,
  onDelete,
  onReadToggle,
}: {
  delivery: InboxDelivery | null;
  error: string | null;
  isMobile: boolean;
  pending: boolean;
  onArchiveToggle: () => void;
  onBack: () => void;
  onContinue: () => void;
  onDelete: () => void;
  onReadToggle: () => void;
}) {
  if (!delivery) {
    return <main className="flex min-h-0 flex-col"><InboxEmptyState selection /></main>;
  }
  return (
    <main className="flex min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/60 px-5 py-4 sm:px-8 sm:py-6">
        {isMobile ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("inboxTitle")}
          </button>
        ) : null}
        <div className="text-xs text-muted-foreground">
          {t("inboxDeliveredBy")} · {formatDateTime(delivery.createdAt)}
        </div>
        <h2 className="mt-3 text-balance text-2xl font-semibold leading-tight tracking-[-0.02em] text-foreground">
          {delivery.title}
        </h2>
        {delivery.summary ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {delivery.summary}
          </p>
        ) : null}
      </div>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <InboxDeliveryContent content={delivery.content} />
        </div>
      </div>
      <div className="shrink-0 border-t border-border/60 px-5 py-3 sm:px-8">
        {error ? <p role="alert" className="mb-2 text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={pending} onClick={onContinue}>
            <MessageCircle className="mr-2 h-4 w-4" />
            {t("inboxContinueChat")}
          </Button>
          <Button variant="outline" disabled={pending} onClick={onReadToggle}>
            {delivery.readAt ? t("inboxMarkUnread") : t("inboxMarkRead")}
          </Button>
          <Button variant="ghost" disabled={pending} onClick={onArchiveToggle}>
            {delivery.archivedAt
              ? <RotateCcw className="mr-2 h-4 w-4" />
              : <Archive className="mr-2 h-4 w-4" />}
            {delivery.archivedAt ? t("inboxRestore") : t("inboxArchive")}
          </Button>
          <Button variant="ghost" disabled={pending} onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            {t("inboxDelete")}
          </Button>
        </div>
      </div>
    </main>
  );
}

export function InboxPage() {
  const navigate = useNavigate();
  const { deliveryId } = useParams<{ deliveryId?: string }>();
  const { isMobile } = useViewportLayout();
  const { inboxManager } = useAppPresenter();
  const deliveriesQuery = useInboxDeliveries();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [filter, setFilter] = useState<InboxFilter>("unread");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deliveries = useMemo(
    () => deliveriesQuery.data?.deliveries ?? [],
    [deliveriesQuery.data?.deliveries],
  );
  const activeDelivery = useMemo(
    () => deliveryId
      ? deliveries.find(({ id }) => id === deliveryId) ?? null
      : null,
    [deliveries, deliveryId],
  );

  useEffect(() => {
    if (activeDelivery && !activeDelivery.readAt) {
      void inboxManager.markRead(activeDelivery.id).catch(() => setError(t("inboxActionError")));
    }
  }, [activeDelivery, inboxManager]);

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

  const continueInChat = () => {
    if (!activeDelivery) {
      return;
    }
    void runAction("continue", async () => {
      const result = await inboxManager.continueInChat(activeDelivery.id);
      navigate(`/chat/${encodeURIComponent(result.sessionId)}`);
    });
  };

  const deleteDelivery = async () => {
    if (!activeDelivery || !await confirm({
      title: t("inboxDeleteTitle"),
      description: t("inboxDeleteDescription"),
      confirmLabel: t("inboxDeleteConfirm"),
      variant: "destructive",
    })) {
      return;
    }
    void runAction("delete", async () => {
      await inboxManager.delete(activeDelivery.id);
      navigate("/inbox", { replace: true });
    });
  };

  const toggleRead = () => {
    if (!activeDelivery) {
      return;
    }
    void runAction("read", async () => {
      if (activeDelivery.readAt) {
        await inboxManager.markUnread(activeDelivery.id);
        navigate("/inbox", { replace: true });
        return;
      }
      await inboxManager.markRead(activeDelivery.id);
    });
  };

  const toggleArchive = () => {
    if (!activeDelivery) {
      return;
    }
    void runAction("archive", async () => {
      if (activeDelivery.archivedAt) {
        await inboxManager.restore(activeDelivery.id);
        return;
      }
      await inboxManager.archive(activeDelivery.id);
      navigate("/inbox", { replace: true });
    });
  };

  const showList = !isMobile || !activeDelivery;
  const showDetail = !isMobile || Boolean(activeDelivery);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <InboxPageHeader unreadCount={deliveriesQuery.data?.unreadCount ?? 0} />

      <div className="min-h-0 flex-1 overflow-hidden border-y border-border/60 bg-background sm:rounded-2xl sm:border">
        {deliveriesQuery.isError ? (
          <div role="alert" className="p-6 text-sm text-destructive">{t("inboxLoadError")}</div>
        ) : (
          <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]">
            {showList ? <InboxListPane
              activeDeliveryId={activeDelivery?.id ?? null}
              deliveries={deliveries}
              filter={filter}
              onFilterChange={setFilter}
            /> : null}
            {showDetail ? <InboxDetailPane
              delivery={activeDelivery}
              error={error}
              isMobile={isMobile}
              pending={pendingAction !== null}
              onArchiveToggle={toggleArchive}
              onBack={() => navigate("/inbox")}
              onContinue={continueInChat}
              onDelete={() => void deleteDelivery()}
              onReadToggle={toggleRead}
            /> : null}
          </div>
        )}
      </div>
      <ConfirmDialog />
    </div>
  );
}
