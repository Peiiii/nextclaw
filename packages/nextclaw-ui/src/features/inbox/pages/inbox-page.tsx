import { useEffect, useMemo, useState } from "react";
import type { InboxDelivery } from "@nextclaw/shared";
import { Archive, ArrowLeft, Inbox, MessageCircle, RotateCcw, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { PageHeader } from "@/app/components/layout/page-layout";
import { useViewportLayout } from "@/app/hooks/use-viewport-layout";
import { CHAT_DRAFT_SESSION_PATH } from "@/features/chat";
import { InboxDeliveryContent } from "@/features/inbox/components/inbox-delivery-content";
import { useInboxDeliveries } from "@/features/inbox/hooks/use-inbox-deliveries";
import { Button } from "@/shared/components/ui/button";
import { useConfirmDialog } from "@/shared/hooks/use-confirm-dialog";
import { formatDateShort, formatDateTime, t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

type InboxFilter = "unread" | "all" | "archived";

export function resolveInboxFilter(
  deliveries: readonly Pick<InboxDelivery, "archivedAt" | "readAt">[],
  selectedFilter: InboxFilter | null,
): InboxFilter {
  if (selectedFilter) {
    return selectedFilter;
  }
  return deliveries.some((delivery) => !delivery.readAt && !delivery.archivedAt)
    ? "unread"
    : "all";
}

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
  const filterItems: Array<{ id: InboxFilter; label: string; count: number }> = [
    {
      id: "unread",
      label: t("inboxUnread"),
      count: filterDeliveries(deliveries, "unread").length,
    },
    { id: "all", label: t("inboxAll"), count: filterDeliveries(deliveries, "all").length },
    {
      id: "archived",
      label: t("inboxArchived"),
      count: filterDeliveries(deliveries, "archived").length,
    },
  ];
  const filteredDeliveries = filterDeliveries(deliveries, filter);
  return (
    <aside className="flex min-h-0 flex-col border-border/60 bg-muted/20 md:border-r">
      <div className="flex shrink-0 gap-1 border-b border-border/50 px-3 py-2">
        {filterItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onFilterChange(item.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border",
              filter === item.id
                ? "bg-[var(--interaction-selection)] text-foreground"
                : "text-muted-foreground hover:bg-[var(--interaction-hover)] hover:text-foreground",
            )}
          >
            {item.label}
            <span aria-hidden="true" className="text-[10px] font-normal tabular-nums opacity-60">
              {item.count}
            </span>
          </button>
        ))}
      </div>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
        {filteredDeliveries.length > 0 ? (
          <ul className="space-y-0.5">
            {filteredDeliveries.map((delivery) => (
              <li key={delivery.id}>
                <Link
                  to={`/inbox/${encodeURIComponent(delivery.id)}`}
                  className={cn(
                    "block rounded-lg px-2.5 py-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border",
                    activeDeliveryId === delivery.id
                      ? "bg-[var(--interaction-selection)] text-foreground"
                      : "text-foreground/80 hover:bg-[var(--interaction-hover)] hover:text-foreground",
                  )}
                >
                  <h2 className={cn(
                    "truncate font-medium leading-5",
                    !delivery.readAt && "font-semibold text-foreground",
                  )}>
                    {delivery.title}
                  </h2>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] leading-4 text-muted-foreground/65">
                    <p className="min-w-0 flex-1 truncate">
                      {delivery.summary ?? t("inboxNoSummary")}
                    </p>
                    {!delivery.readAt ? (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-primary"
                        aria-label={t("inboxUnread")}
                      />
                    ) : (
                      <time className="shrink-0 tabular-nums" dateTime={delivery.createdAt}>
                        {formatDateShort(delivery.createdAt)}
                      </time>
                    )}
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
  const isHtml = delivery.contentType === "html";
  return (
    <main className="flex min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/50 px-5 py-3 sm:px-6">
        {isMobile ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("inboxTitle")}
          </button>
        ) : null}
        <div className="flex min-h-7 min-w-0 items-center gap-2">
          <h2
            title={delivery.title}
            className="min-w-0 truncate text-sm font-medium text-foreground"
          >
            {delivery.title}
          </h2>
          <span className="hidden shrink-0 text-muted-foreground sm:inline" aria-hidden="true">·</span>
          <time
            className="hidden shrink-0 text-[11px] tabular-nums text-muted-foreground sm:block"
            dateTime={delivery.createdAt}
          >
            {formatDateTime(delivery.createdAt)}
          </time>
        </div>
      </div>
      <div className={cn(
        "min-h-0 flex-1",
        isHtml
          ? "p-3 sm:p-4"
          : "custom-scrollbar overflow-y-auto px-5 py-5 sm:px-6 sm:py-6",
      )}>
        <div className={cn("mx-auto max-w-5xl", isHtml && "h-full")}>
          <InboxDeliveryContent
            className={isHtml ? "h-full" : undefined}
            content={delivery.content}
            contentType={delivery.contentType}
            fillHeight={isHtml}
            title={delivery.title}
          />
        </div>
      </div>
      <div className="shrink-0 border-t border-border/50 px-5 py-3 sm:px-6">
        {error ? <p role="alert" className="mb-2 text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1">
            <Button size="sm" variant="outline" disabled={pending} onClick={onReadToggle}>
              {delivery.readAt ? t("inboxMarkUnread") : t("inboxMarkRead")}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={onArchiveToggle}>
              {delivery.archivedAt
                ? <RotateCcw className="mr-2 h-4 w-4" />
                : <Archive className="mr-2 h-4 w-4" />}
              {delivery.archivedAt ? t("inboxRestore") : t("inboxArchive")}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t("inboxDelete")}
            </Button>
          </div>
          <Button size="sm" disabled={pending} onClick={onContinue}>
            <MessageCircle className="mr-2 h-4 w-4" />
            {t("inboxContinueChat")}
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
  const { chatDraftIntentManager, inboxManager } = useAppPresenter();
  const deliveriesQuery = useInboxDeliveries();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [selectedFilter, setSelectedFilter] = useState<InboxFilter | null>(null);
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
  const filter = resolveInboxFilter(deliveries, selectedFilter);

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
      const { reference } = await inboxManager.prepareChatReference(activeDelivery.id);
      chatDraftIntentManager.requestSystemObjectReference(reference);
      navigate(CHAT_DRAFT_SESSION_PATH);
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
    <div className="flex h-full min-h-0 flex-col gap-6">
      <PageHeader
        headingLevel={1}
        title={t("inboxTitle")}
        className="px-4 sm:px-0"
      />

      <div className="min-h-0 flex-1 overflow-hidden border-y border-border/60 bg-background sm:rounded-2xl sm:border">
        {deliveriesQuery.isError ? (
          <div role="alert" className="p-6 text-sm text-destructive">{t("inboxLoadError")}</div>
        ) : (
          <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)]">
            {showList ? <InboxListPane
              activeDeliveryId={activeDelivery?.id ?? null}
              deliveries={deliveries}
              filter={filter}
              onFilterChange={setSelectedFilter}
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
