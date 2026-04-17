/* eslint-disable max-lines-per-function */
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
  MarketplaceMcpDoctorResult,
  MarketplaceSort,
} from "@/api/types";
import {
  fetchMcpMarketplaceContent,
  doctorMcpMarketplaceItem,
} from "@/api/mcp-marketplace";
import { PageHeader, PageLayout } from "@/components/layout/page-layout";
import {
  MarketplaceInfiniteScrollStatus,
  MarketplaceListSkeleton,
} from "@/components/marketplace/marketplace-page-parts";
import { buildLocaleFallbacks } from "@/components/marketplace/marketplace-localization";
import { McpMarketplaceCard } from "@/components/marketplace/mcp/mcp-marketplace-card";
import {
  buildDocDataUrl,
  buildInstalledRecordLookup,
  findInstalledRecordForItem,
  readSummary,
} from "@/components/marketplace/mcp/mcp-marketplace-doc";
import {
  DoctorDialog,
  InstallDialog,
} from "@/components/marketplace/mcp/mcp-marketplace-dialogs";
import { Tabs } from "@/components/ui/tabs-custom";
import { Input } from "@/components/ui/input";
import { NoticeCard } from "@/components/ui/notice-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import {
  useInstallMcpMarketplaceItem,
  useManageMcpMarketplaceItem,
  useMcpMarketplaceInstalled,
  useMcpMarketplaceItems,
} from "@/hooks/useMcpMarketplace";
import { useDocBrowser } from "@/components/doc-browser";
import { useI18n } from "@/components/providers/I18nProvider";
import { t } from "@/lib/i18n";
import { useInfiniteScrollLoader } from "@/hooks/use-infinite-scroll-loader";

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
    const summary = readSummary(localeFallbacks, item, record);
    if (!item) {
      const url = buildDocDataUrl(
        title,
        JSON.stringify(record ?? {}, null, 2),
        t("marketplaceInstalledLocalSummary"),
        record?.docsUrl,
        summary,
      );
      docBrowser.open(url, { newTab: true, title, kind: "content" });
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
      docBrowser.open(url, { newTab: true, title, kind: "content" });
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
      docBrowser.open(url, { newTab: true, title, kind: "content" });
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

  return (
    <PageLayout className="flex h-full min-h-0 flex-col pb-0">
      <PageHeader
        title={t("marketplaceMcpPageTitle")}
        description={t("marketplaceMcpPageDescription")}
      />

      <Tabs
        tabs={[
          { id: "catalog", label: t("marketplaceMcpTabCatalog") },
          {
            id: "installed",
            label: t("marketplaceMcpTabInstalled"),
            count: installedQuery.data?.total ?? 0,
          },
        ]}
        activeTab={scope}
        onChange={(value) => setScope(value as ScopeType)}
        className="mb-4"
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder={t("marketplaceMcpSearchPlaceholder")}
          className="md:max-w-sm"
        />

        <Select
          value={sort}
          onValueChange={(value) => setSort(value as MarketplaceSort)}
        >
          <SelectTrigger className="h-9 w-[180px] rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">
              {t("marketplaceSortRelevance")}
            </SelectItem>
            <SelectItem value="updated">
              {t("marketplaceSortUpdated")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            {scope === "catalog"
              ? t("marketplaceMcpSectionCatalog")
              : t("marketplaceMcpSectionInstalled")}
          </h3>
          <span className="text-xs text-gray-500">
            {scope === "catalog"
              ? (itemsQuery.data?.total ?? 0)
              : (installedQuery.data?.total ?? 0)}
          </span>
        </div>

        <div
          ref={containerRef}
          className="min-h-0 flex-1 overflow-y-auto pr-1"
          aria-busy={itemsQuery.isLoading || itemsQuery.isFetchingNextPage}
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {scope === "catalog" && itemsQuery.isLoading && (
              <MarketplaceListSkeleton count={6} />
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
            (itemsQuery.data?.items?.length ?? 0) === 0 && (
              <div className="py-8 text-center text-sm text-gray-500">
                {t("marketplaceNoMcp")}
              </div>
            )}
          {scope === "installed" && installedRecords.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-500">
              {t("marketplaceNoInstalledMcp")}
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
    </PageLayout>
  );
}
