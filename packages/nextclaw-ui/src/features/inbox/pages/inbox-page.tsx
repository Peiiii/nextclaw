import { PageResourceActionsMenu } from '@/features/right-panel-resources';
import { pageResourceFromSystemObject } from '@/features/right-panel-resources';
import { useEffect, useMemo, useState } from "react";
import type { InboxDelivery } from "@nextclaw/shared";
import { Archive, ArrowLeft, Inbox, MessageCircle, MoreVertical, RotateCcw, Trash2 } from "lucide-react";
import { ContextMenu, ContextMenuTrigger } from '@/shared/components/ui/context-menu/context-menu';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { PageHeader } from "@/app/components/layout/page-layout";
import { useViewportLayout } from "@/app/hooks/use-viewport-layout";
import { buildSessionPath, CHAT_DRAFT_SESSION_PATH } from "@/features/chat";
import { InboxDeliveryContent } from "@/features/inbox/components/inbox-delivery-content";
import { useInboxDeliveries } from "@/features/inbox/hooks/use-inbox-deliveries";
import { Button } from "@/shared/components/ui/button";
import { useConfirmDialog } from "@/shared/hooks/use-confirm-dialog";
import { formatDateShort, formatDateTime, t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { useScrollRestoration } from "@/shared/hooks/use-scroll-restoration";

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
  const scrollRestoration = useScrollRestoration<HTMLDivElement>({
    restorationKey: "inbox:list",
  });
  const { onScroll, scrollRef } = scrollRestoration;
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
            aria-pressed={filter === item.id}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border md:min-h-0 md:px-2.5 md:text-xs",
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
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-2"
      >
        {filteredDeliveries.length > 0 ? (
          <ul className="space-y-0.5">
            {filteredDeliveries.map((delivery) => (
              <li key={delivery.id} className={cn(
                "group/page-row relative rounded-lg hover:bg-[var(--interaction-hover)] focus-within:bg-[var(--interaction-hover)] has-[[data-context-menu-open]]:bg-[var(--interaction-hover)]",
                activeDeliveryId === delivery.id && "bg-[var(--interaction-selection)] hover:bg-[var(--interaction-selection)] focus-within:bg-[var(--interaction-selection)] has-[[data-context-menu-open]]:bg-[var(--interaction-selection)]",
              )}>
                <Link
                  to={`/inbox/${encodeURIComponent(delivery.id)}`}
                  className={cn(
                    "block rounded-lg px-2.5 py-3 pr-12 text-sm md:py-2 md:pr-10 md:text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border",
                    activeDeliveryId === delivery.id
                      ? "text-foreground"
                      : "text-foreground/80 hover:text-foreground",
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
                <span className="absolute right-1 top-1.5">
                  <PageResourceActionsMenu revealOnHover page={pageResourceFromSystemObject("inbox-delivery", delivery.id, delivery.title)} />
                </span>
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
  isMobile,
  error,
  pending,
  onArchiveToggle,
  onContinue,
  onDelete,
  onReadToggle,
}: {
  delivery: InboxDelivery | null;
  isMobile: boolean;
  error: string | null;
  pending: boolean;
  onArchiveToggle: () => void;
  onContinue: () => void;
  onDelete: () => void;
  onReadToggle: () => void;
}) {
  const navigate = useNavigate();
  const backButton = <IconActionButton size="sm" icon={<ArrowLeft className="h-4 w-4" />} label={t("inboxTitle")} onClick={() => navigate('/inbox')} />;
  const scrollRestoration = useScrollRestoration<HTMLDivElement>({
    restorationKey: delivery ? `inbox:delivery:${delivery.id}` : null,
  });
  const { onScroll, scrollRef } = scrollRestoration;
  if (!delivery) {
    return <main className="flex min-h-0 flex-col"><div className="md:hidden">{backButton}</div><InboxEmptyState selection /></main>;
  }
  const isHtml = delivery.contentType === "html";
  return (
    <main className="flex min-h-0 min-w-0 flex-col max-md:pt-[env(safe-area-inset-top,0px)] max-md:pb-[env(safe-area-inset-bottom,0px)]">
      <div className="shrink-0 border-b border-border/50 px-2 py-2 md:px-6 md:py-3">
        <div className="flex min-h-7 min-w-0 items-center gap-1">
          <div className="md:hidden">{backButton}</div>
          <h2
            title={delivery.title}
            className="min-w-0 flex-1 truncate text-sm font-medium text-foreground md:flex-none"
          >
            {delivery.title}
          </h2>
          <span className="hidden shrink-0 text-muted-foreground md:inline" aria-hidden="true">·</span>
          <time
            className="hidden shrink-0 text-[11px] tabular-nums text-muted-foreground md:block"
            dateTime={delivery.createdAt}
          >
            {formatDateTime(delivery.createdAt)}
          </time>
          {isMobile ? <div className="flex shrink-0 items-center">
            <IconActionButton size="sm" icon={<MessageCircle className="h-4 w-4" />} label={t('inboxContinueChat')} disabled={pending} onClick={onContinue} />
            <ContextMenu label={t('inboxTitle')} groups={[{ key: 'delivery', items: [
              { key: 'read', label: delivery.readAt ? t('inboxMarkUnread') : t('inboxMarkRead'), disabled: pending, onSelect: onReadToggle },
              { key: 'archive', label: delivery.archivedAt ? t('inboxRestore') : t('inboxArchive'), icon: <Archive className="h-4 w-4" />, disabled: pending, onSelect: onArchiveToggle },
              { key: 'delete', label: t('inboxDelete'), icon: <Trash2 className="h-4 w-4" />, destructive: true, disabled: pending, onSelect: onDelete },
            ] }]}>
              <div><ContextMenuTrigger><IconActionButton size="sm" icon={<MoreVertical className="h-4 w-4" />} label={t('more')} /></ContextMenuTrigger></div>
            </ContextMenu>
          </div> : null}
        </div>
      </div>
      {error ? <p role="alert" className="shrink-0 px-4 py-2 text-sm text-destructive">{error}</p> : null}
      <div className={cn(
        "min-h-0 flex-1",
        isHtml
          ? "p-0 md:p-4"
          : "custom-scrollbar overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6",
      )}
      ref={scrollRef}
      onScroll={onScroll}
      >
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
      {!isMobile ? <div className="shrink-0 border-t border-border/50 px-6 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="hidden md:flex flex-wrap items-center gap-1">
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
      </div> : null}
    </main>
  );
}

export function InboxPage() {
  const navigate = useNavigate();
  const { deliveryId } = useParams<{ deliveryId?: string }>();
  const { isMobile } = useViewportLayout();
  const { chatComposerIntentManager, docBrowserManager, inboxManager } = useAppPresenter();
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
      const { reference, targetSessionKey } = await inboxManager.prepareChatReference(activeDelivery.id);
      chatComposerIntentManager.requestSystemObjectReference({ targetSessionKey, reference });
      if (isMobile) docBrowserManager.close();
      navigate(targetSessionKey ? buildSessionPath(targetSessionKey) : CHAT_DRAFT_SESSION_PATH);
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

  const showList = !isMobile || !deliveryId;
  const showDetail = !isMobile || Boolean(deliveryId);

  return (
    <div className="flex h-full min-h-0 flex-col md:gap-6">
      {!isMobile ? <PageHeader
        headingLevel={1}
        title={t("inboxTitle")}
        className="px-4 sm:px-0"
      /> : null}

      <div className="min-h-0 flex-1 overflow-hidden bg-background md:rounded-2xl md:border md:border-border/60">
        {deliveriesQuery.isError ? (
          <div className="p-4">{isMobile && deliveryId ? <IconActionButton icon={<ArrowLeft className="h-4 w-4" />} label={t("inboxTitle")} onClick={() => navigate('/inbox')} /> : null}<p role="alert" className="text-sm text-destructive">{t("inboxLoadError")}</p></div>
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
              isMobile={isMobile}
              error={error}
              pending={pendingAction !== null}
              onArchiveToggle={toggleArchive}
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
