import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
} from "@/shared/lib/api";
import { fetchMarketplaceSkillContent } from "@/shared/lib/api";
import { useDocBrowser } from "@/shared/components/doc-browser";
import { buildGenericDetailDataUrl } from "@/features/marketplace/components/marketplace-detail-doc";
import { pickLocalizedText } from "@/features/marketplace/components/marketplace-localization";
import { t } from "@/shared/lib/i18n";
import { useRef } from "react";

export function useMarketplaceItemDetail(localeFallbacks: string[]) {
  const docBrowser = useDocBrowser();
  const detailRequestRef = useRef({ byKey: new Map<string, number>(), seq: 0 });

  const openItemDetail = async (
    item?: MarketplaceItemSummary,
    record?: MarketplaceInstalledRecord,
  ) => {
    const title =
      item?.name ??
      record?.label ??
      record?.id ??
      record?.spec ??
      t("marketplaceUnknownItem");
    const dedupeKey = item
      ? `marketplace:${item.type}:${item.slug}`
      : `marketplace:${record?.type ?? "unknown"}:${record?.id ?? record?.spec ?? title}`;
    const openOptions = { title, kind: "content" as const, dedupeKey };
    const updateOptions = { ...openOptions, activate: false };
    const typeLabel = t("marketplaceTypeSkill");

    if (!item) {
      docBrowser.open(
        buildGenericDetailDataUrl({
          title,
          typeLabel,
          spec: record?.spec ?? "-",
          summary: t("marketplaceInstalledLocalSummary"),
          metadataRaw: JSON.stringify(record ?? {}, null, 2),
          contentRaw: "-",
        }),
        openOptions,
      );
      return;
    }

    const requestId = detailRequestRef.current.seq + 1;
    detailRequestRef.current.seq = requestId;
    detailRequestRef.current.byKey.set(dedupeKey, requestId);
    const summary = pickLocalizedText(
      item.summaryI18n,
      item.summary,
      localeFallbacks,
    );
    docBrowser.open(
      buildGenericDetailDataUrl({
        title,
        typeLabel,
        spec: item.install.spec,
        loading: true,
      }),
      openOptions,
    );

    try {
      const content = await fetchMarketplaceSkillContent(item.slug);
      if (detailRequestRef.current.byKey.get(dedupeKey) !== requestId) {
        return;
      }
      docBrowser.open(
        buildGenericDetailDataUrl({
          title,
          typeLabel,
          spec: item.install.spec,
          summary,
          metadataRaw: content.metadataRaw,
          contentRaw: content.bodyRaw || content.raw,
          sourceUrl: content.sourceUrl,
          sourceLabel: `Source (${content.source})`,
          tags: item.tags,
          author: item.author,
        }),
        updateOptions,
      );
    } catch (error) {
      if (detailRequestRef.current.byKey.get(dedupeKey) !== requestId) {
        return;
      }
      docBrowser.open(
        buildGenericDetailDataUrl({
          title,
          typeLabel,
          spec: item.install.spec,
          summary,
          metadataRaw: JSON.stringify(
            { error: error instanceof Error ? error.message : String(error) },
            null,
            2,
          ),
          contentRaw: t("marketplaceOperationFailed"),
        }),
        updateOptions,
      );
    }
  };

  return { openItemDetail };
}
