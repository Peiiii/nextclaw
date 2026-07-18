/* eslint-disable max-lines-per-function */
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
  MarketplaceMcpDoctorResult,
  MarketplaceSort,
} from "@/shared/lib/api";
import {
  fetchMcpMarketplaceContent,
  doctorMcpMarketplaceItem,
} from "@/shared/lib/api";
import { SettingsPage } from "@/shared/components/settings/settings-page";
import {
  MarketplaceInfiniteScrollStatus,
  MarketplaceListSkeleton,
  FilterPanel,
} from "@/features/marketplace/components/marketplace-page-parts";
import { buildLocaleFallbacks } from "@/features/marketplace/components/marketplace-localization";
import { McpMarketplaceCard } from "@/features/marketplace/components/mcp/mcp-marketplace-card";
import {
  buildInstalledRecordLookup,
  findInstalledRecordForItem,
  readSummary,
} from "@/features/marketplace/components/mcp/mcp-marketplace-doc";
import {
  createMarketplaceDetailDocId,
  openMarketplaceDetailDoc,
} from "@/features/marketplace/components/marketplace-detail-doc";
import {
  DoctorDialog,
  InstallDialog,
} from "@/features/marketplace/components/mcp/mcp-marketplace-dialogs";
import { NoticeCard } from "@/shared/components/feedback/notice-card";
import { useConfirmDialog } from "@/shared/hooks/use-confirm-dialog";
import {
  useInstallMcpMarketplaceItem,
  useManageMcpMarketplaceItem,
  useMcpMarketplaceInstalled,
  useMcpMarketplaceItems,
} from "@/features/marketplace/hooks/use-mcp-marketplace";
import { useDocBrowser } from "@/shared/components/doc-browser";
import { useI18n } from "@/app/components/i18n-provider";
import { t } from "@/shared/lib/i18n";
import { useInfiniteScrollLoader } from "@/shared/hooks/use-infinite-scroll-loader";
import { cn } from "@/shared/lib/utils";
import { Sparkles, PackageCheck } from "lucide-react";

type ScopeType = "catalog" | "installed";

const PAGE_SIZE = 12;

export function McpMarketplacePage() {
  const [scope, setScope] = useState<ScopeType>("catalog");
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<MarketplaceSort>("relevance");
  const [installingItem, setInstallingItem] =
    useState<MarketplaceItemSummary | null>(null);
  const [doctorTarget, setDoctorTarget] = useState<string | null>(null);
  const [doctorResult, setDoctorResult] =
    useState<MarketplaceMcpDoctorResult | null>(null);
  const { language } = useI18n();
  const docBrowser = useDocBrowser();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const localeFallbacks = useMemo(
    () => buildLocaleFallbacks(language),
    [language],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchText.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const itemsQuery = useMcpMarketplaceItems({
    q: query || undefined,
    sort,
    pageSize: PAGE_SIZE,
  });
  const installedQuery = useMcpMarketplaceInstalled();

  const infiniteScroll = useInfiniteScrollLoader({
    disabled:
      scope !== "catalog" ||
      itemsQuery.isError ||
      !itemsQuery.hasNextPage ||
      itemsQuery.isFetchingNextPage,
    onLoadMore: () => itemsQuery.fetchNextPage(),
    watchValue: `${scope}:${query}:${sort}:${itemsQuery.data?.loadedItems ?? 0}:${itemsQuery.data?.loadedPages ?? 0}`,
  });
  const { containerRef, sentinelRef } = infiniteScroll;

  useEffect(() => {
    const container = containerRef.current;
    if (container && typeof container.scrollTo === "function") {
      container.scrollTo({ top: 0 });
    }
  }, [containerRef, query, scope, sort]);

  const installMutation = useInstallMcpMarketplaceItem();
  const manageMutation = useManageMcpMarketplaceItem();
  const doctorMutation = useMutation({
    mutationFn: doctorMcpMarketplaceItem,
    onSuccess: (result, name) => {
      setDoctorTarget(name);
      setDoctorResult(result);
    },
  });

  const installedRecordLookup = useMemo(() => {
    return buildInstalledRecordLookup(installedQuery.data?.records ?? []);
  }, [installedQuery.data?.records]);

  const installedRecords = useMemo(() => {
    const entries = installedQuery.data?.records ?? [];
    return entries.filter((record) => {
      const text = [
        record.id ?? "",
        record.label ?? "",
        record.catalogSlug ?? "",
        record.description ?? "",
        record.descriptionZh ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return query ? text.includes(query.toLowerCase()) : true;
    });
  }, [installedQuery.data?.records, query]);

  const openDoc = async (
    item?: MarketplaceItemSummary,
    record?: MarketplaceInstalledRecord,
  ) => {
    const title = item?.name ?? record?.label ?? record?.id ?? "MCP";
    const detailId = createMarketplaceDetailDocId(
      item ? "mcp" : "mcp-local",
      item?.slug ?? record?.id ?? record?.spec ?? title,
    );
    const summary = readSummary(localeFallbacks, item, record);
    if (!item) {
      openMarketplaceDetailDoc(docBrowser, {
        id: detailId,
        title,
        typeLabel: t("marketplaceTypeMcp"),
        spec: record?.spec ?? "-",
        status: "ready",
        summary,
        metadataRaw: JSON.stringify(record ?? {}, null, 2),
        contentRaw: t("marketplaceInstalledLocalSummary"),
        sourceUrl: record?.docsUrl,
        sourceLabel: t("marketplaceDetailSource"),
      });
      return;
    }

    openMarketplaceDetailDoc(docBrowser, {
      id: detailId,
      title,
      typeLabel: t("marketplaceTypeMcp"),
      spec: item.install.spec,
      status: "loading",
      summary,
      tags: item.tags,
      author: item.author,
    });

    try {
      const content = await fetchMcpMarketplaceContent(item.slug);
      openMarketplaceDetailDoc(
        docBrowser,
        {
          id: detailId,
          title,
          typeLabel: t("marketplaceTypeMcp"),
          spec: item.install.spec,
          status: "ready",
          summary,
          metadataRaw: content.metadataRaw || JSON.stringify(item, null, 2),
          contentRaw: content.bodyRaw || content.raw,
          sourceUrl: content.sourceUrl,
          sourceLabel: t("marketplaceDetailSource"),
          tags: item.tags,
          author: item.author,
        },
        { activate: false },
      );
    } catch (error) {
      openMarketplaceDetailDoc(
        docBrowser,
        {
          id: detailId,
          title,
          typeLabel: t("marketplaceTypeMcp"),
          spec: item.install.spec,
          status: "error",
          summary,
          metadataRaw: JSON.stringify(
            { error: error instanceof Error ? error.message : String(error) },
            null,
            2,
          ),
          contentRaw: summary,
        },
        { activate: false },
      );
    }
  };

  const handleInstall = async (payload: {
    name: string;
    allAgents: boolean;
    inputs: Record<string, string>;
  }) => {
    if (!installingItem) {
      return;
    }
    await installMutation.mutateAsync({
      spec: installingItem.slug,
      name: payload.name.trim(),
      allAgents: payload.allAgents,
      inputs: payload.inputs,
    });
    setInstallingItem(null);
  };

  const handleManage = async (
    action: "enable" | "disable" | "remove",
    record: MarketplaceInstalledRecord,
  ) => {
    const target = record.id || record.spec;
    if (!target) {
      return;
    }
    if (action === "remove") {
      const confirmed = await confirm({
        title: `${t("marketplaceMcpRemoveTitle")} ${target}?`,
        description: t("marketplaceMcpRemoveDescription"),
        confirmLabel: t("marketplaceMcpRemove"),
        variant: "destructive",
      });
      if (!confirmed) {
        return;
      }
    }
    await manageMutation.mutateAsync({
      action,
      id: target,
      spec: record.spec,
    });
  };

  const scopeTabs = [
    { id: "catalog", label: t("marketplaceMcpTabCatalog"), icon: Sparkles },
    {
      id: "installed",
      label: t("marketplaceMcpTabInstalled"),
      icon: PackageCheck,
      count: installedQuery.data?.total ?? 0,
    },
  ] as const;

  return (
    <SettingsPage
      title={t("marketplaceMcpPageTitle")}
      description={t("marketplaceMcpPageDescription")}
      layout="split"
    >
        <div className="flex flex-col gap-3">
          <div className="flex w-fit max-w-full items-center gap-1 rounded-xl bg-muted/60 p-1">
            {scopeTabs.map((tab) => {
              const isActive = scope === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setScope(tab.id as ScopeType)}
                  className={cn(
                    "relative flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                  {tab.id === 'installed' && typeof tab.count === 'number' && (
                    <span className={cn(
                      "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                      isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="w-full max-w-xl">
            <FilterPanel
              scope={scope === "catalog" ? "all" : "installed"}
              searchText={searchText}
              isRefreshing={false}
              searchPlaceholder={t("marketplaceMcpSearchPlaceholder")}
              sort={sort}
              onSearchTextChange={setSearchText}
              onSortChange={setSort}
            />
          </div>
        </div>

        <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              {scope === "catalog"
                ? t("marketplaceMcpSectionCatalog")
                : t("marketplaceMcpSectionInstalled")}
              <span className="flex h-6 items-center justify-center rounded-lg bg-muted px-2 text-xs font-medium text-muted-foreground">
                {scope === "catalog"
                  ? (itemsQuery.data?.total ?? 0)
                  : (installedQuery.data?.total ?? 0)}
              </span>
            </h3>
          </div>

          <div
            ref={containerRef}
            className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pb-8"
            aria-busy={itemsQuery.isLoading || itemsQuery.isFetchingNextPage}
          >
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] items-stretch gap-4">
              {scope === "catalog" && itemsQuery.isLoading && (
                <MarketplaceListSkeleton count={PAGE_SIZE} />
              )}

              {scope === "catalog" &&
                !itemsQuery.isLoading &&
                (itemsQuery.data?.items ?? []).map((item) => {
                  const installed = findInstalledRecordForItem(
                    item,
                    installedRecordLookup,
                  );
                  return (
                    <McpMarketplaceCard
                      key={item.id}
                      item={item}
                      record={installed}
                      localeFallbacks={localeFallbacks}
                      onOpen={() => void openDoc(item, installed)}
                      onInstall={() => setInstallingItem(item)}
                      onToggle={
                        installed
                          ? () =>
                              void handleManage(
                                installed.enabled === false
                                  ? "enable"
                                  : "disable",
                                installed,
                              )
                          : undefined
                      }
                      onDoctor={
                        installed
                          ? () => {
                              setDoctorTarget(installed.id ?? null);
                              setDoctorResult(null);
                              void doctorMutation.mutateAsync(installed.id ?? "");
                            }
                          : undefined
                      }
                      onRemove={
                        installed
                          ? () => void handleManage("remove", installed)
                          : undefined
                      }
                    />
                  );
                })}
              {scope === "installed" &&
                installedRecords.map((record) => (
                  <McpMarketplaceCard
                    key={record.id ?? record.spec}
                    record={record}
                    localeFallbacks={localeFallbacks}
                    onOpen={() => void openDoc(undefined, record)}
                    onToggle={() =>
                      void handleManage(
                        record.enabled === false ? "enable" : "disable",
                        record,
                      )
                    }
                    onDoctor={() => {
                      setDoctorTarget(record.id ?? null);
                      setDoctorResult(null);
                      void doctorMutation.mutateAsync(record.id ?? "");
                    }}
                    onRemove={() => void handleManage("remove", record)}
                  />
                ))}
            </div>

            {scope === "catalog" && itemsQuery.isError && (
              <NoticeCard
                tone="danger"
                title={t("marketplaceMcpSectionCatalog")}
                description={itemsQuery.error.message}
              />
            )}
            {scope === "installed" && installedQuery.isError && (
              <NoticeCard
                tone="danger"
                title={t("marketplaceMcpSectionInstalled")}
                description={installedQuery.error.message}
              />
            )}
            {scope === "catalog" &&
              !itemsQuery.isLoading &&
              !itemsQuery.isError &&
              (itemsQuery.data?.items?.length ?? 0) === 0 && (
                <div className="mt-4 flex flex-col items-center justify-center rounded-2xl bg-muted/35 py-16">
                  <p className="text-sm font-medium text-muted-foreground">{t("marketplaceNoMcp")}</p>
                </div>
              )}
            {scope === "installed" && !installedQuery.isError && installedRecords.length === 0 && (
              <div className="mt-4 flex flex-col items-center justify-center rounded-2xl bg-muted/35 py-16">
                <p className="text-sm font-medium text-muted-foreground">{t("marketplaceNoInstalledMcp")}</p>
              </div>
            )}

            {scope === "catalog" && !itemsQuery.isError && (
              <MarketplaceInfiniteScrollStatus
                hasMore={Boolean(itemsQuery.hasNextPage)}
                loading={itemsQuery.isFetchingNextPage}
                sentinelRef={sentinelRef}
              />
            )}
          </div>
        </section>

      <InstallDialog
        item={installingItem}
        open={Boolean(installingItem)}
        pending={installMutation.isPending}
        onOpenChange={(open) => !open && setInstallingItem(null)}
        onSubmit={handleInstall}
      />
      <DoctorDialog
        open={Boolean(doctorTarget)}
        targetName={doctorTarget}
        result={doctorResult}
        pending={doctorMutation.isPending}
        onOpenChange={(open) => !open && setDoctorTarget(null)}
      />
      <ConfirmDialog />
    </SettingsPage>
  );
}
