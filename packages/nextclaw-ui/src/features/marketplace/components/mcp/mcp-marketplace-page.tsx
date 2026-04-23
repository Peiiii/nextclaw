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
import { PageLayout } from "@/app/components/layout/page-layout";
import {
  MarketplaceInfiniteScrollStatus,
  MarketplaceListSkeleton,
  FilterPanel,
} from "@/features/marketplace/components/marketplace-page-parts";
import { buildLocaleFallbacks } from "@/features/marketplace/components/marketplace-localization";
import { McpMarketplaceCard } from "@/features/marketplace/components/mcp/mcp-marketplace-card";
import {
  buildDocDataUrl,
  buildInstalledRecordLookup,
  findInstalledRecordForItem,
  readSummary,
} from "@/features/marketplace/components/mcp/mcp-marketplace-doc";
import {
  DoctorDialog,
  InstallDialog,
} from "@/features/marketplace/components/mcp/mcp-marketplace-dialogs";
import { NoticeCard } from "@/shared/components/ui/notice-card";
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
    const dedupeKey = item
      ? `marketplace:mcp:${item.slug}`
      : `marketplace:mcp:${record?.id ?? record?.spec ?? title}`;
    const openOptions = { title, kind: "content" as const, dedupeKey };
    const summary = readSummary(localeFallbacks, item, record);
    if (!item) {
      const url = buildDocDataUrl(
        title,
        JSON.stringify(record ?? {}, null, 2),
        t("marketplaceInstalledLocalSummary"),
        record?.docsUrl,
        summary,
      );
      docBrowser.open(url, openOptions);
      return;
    }
    try {
      const content = await fetchMcpMarketplaceContent(item.slug);
      const url = buildDocDataUrl(
        title,
        content.metadataRaw || JSON.stringify(item, null, 2),
        content.bodyRaw || content.raw,
        content.sourceUrl,
        summary,
      );
      docBrowser.open(url, openOptions);
    } catch (error) {
      const url = buildDocDataUrl(
        title,
        JSON.stringify(
          { error: error instanceof Error ? error.message : String(error) },
          null,
          2,
        ),
        summary,
        undefined,
        summary,
      );
      docBrowser.open(url, openOptions);
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
    <PageLayout className="flex h-full min-h-0 flex-col pb-0 px-0">
      <div className="flex flex-col gap-6 w-full max-w-[1400px] h-full min-h-0 mx-auto">
        
        {/* Modern App Store Hero for MCP */}
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#312E81] px-10 py-14 text-white shadow-xl isolate">
          <div className="absolute top-0 right-0 -m-32 opacity-30 pointer-events-none mix-blend-screen scale-150 transform-gpu">
            <div className="w-[500px] h-[500px] rounded-full bg-gradient-to-tl from-fuchsia-500/40 via-purple-500/30 to-indigo-500/20 blur-[80px]"></div>
          </div>
          <div className="absolute bottom-0 left-0 -m-32 opacity-20 pointer-events-none mix-blend-screen transform-gpu">
            <div className="w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-blue-500/40 to-cyan-500/20 blur-[80px]"></div>
          </div>
          
          <div className="relative z-10 flex flex-col gap-3">
            <h1 className="text-[38px] font-extrabold tracking-[-0.02em] leading-tight drop-shadow-sm text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/70">
              {t("marketplaceMcpPageTitle")}
            </h1>
            <p className="text-[17px] font-medium text-purple-100/70 max-w-2xl leading-relaxed tracking-wide">
              {t("marketplaceMcpPageDescription")}
            </p>
          </div>
        </div>

        {/* Custom Nav & Filter Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
          {/* Custom App Store Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-gray-100/60 backdrop-blur-sm rounded-2xl w-fit border border-gray-200/50 shadow-inner">
            {scopeTabs.map((tab) => {
              const isActive = scope === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setScope(tab.id as ScopeType)}
                  className={cn(
                    "relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-[14px] transition-all duration-300",
                    isActive
                      ? "text-gray-900 bg-white shadow-[0_2px_10px_rgb(0,0,0,0.06)]"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/40"
                  )}
                >
                  <Icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-gray-400")} />
                  {tab.label}
                  {tab.id === 'installed' && typeof tab.count === 'number' && (
                    <span className={cn(
                      "ml-1 flex items-center justify-center h-5 px-1.5 min-w-5 rounded-full text-[11px] font-bold transition-colors",
                      isActive ? "bg-primary/10 text-primary" : "bg-gray-200 text-gray-500"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 w-full md:max-w-md">
            <FilterPanel
              scope={scope === "catalog" ? "all" : "installed"}
              searchText={searchText}
              searchPlaceholder={t("marketplaceMcpSearchPlaceholder")}
              sort={sort}
              onSearchTextChange={setSearchText}
              onSortChange={setSort}
            />
          </div>
        </div>

        <section className="flex min-h-0 flex-1 flex-col mt-2">
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-[18px] font-bold tracking-tight text-gray-900 flex items-center gap-2">
              {scope === "catalog"
                ? t("marketplaceMcpSectionCatalog")
                : t("marketplaceMcpSectionInstalled")}
              <span className="flex items-center justify-center h-6 px-2 rounded-lg bg-gray-100 text-[12px] font-semibold text-gray-500">
                {scope === "catalog"
                  ? (itemsQuery.data?.total ?? 0)
                  : (installedQuery.data?.total ?? 0)}
              </span>
            </h3>
          </div>

          <div
            ref={containerRef}
            className="min-h-0 flex-1 overflow-y-auto pr-3 pb-8 -mx-1 px-1 custom-scrollbar"
            aria-busy={itemsQuery.isLoading || itemsQuery.isFetchingNextPage}
          >
            <div className="grid grid-cols-1 gap-[22px] md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 items-stretch">
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
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200 mt-4">
                  <p className="text-[15px] font-medium text-gray-500">{t("marketplaceNoMcp")}</p>
                </div>
              )}
            {scope === "installed" && !installedQuery.isError && installedRecords.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200 mt-4">
                <p className="text-[15px] font-medium text-gray-500">{t("marketplaceNoInstalledMcp")}</p>
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

      </div>

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
    </PageLayout>
  );
}
