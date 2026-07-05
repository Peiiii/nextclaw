import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
} from "@/shared/lib/api";
import { fetchMarketplaceSkillContent } from "@/shared/lib/api";
import { useDocBrowser } from "@/shared/components/doc-browser";
import {
  createMarketplaceDetailDocId,
  openMarketplaceDetailDoc,
} from "@/features/marketplace/components/marketplace-detail-doc";
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
    const detailId = createMarketplaceDetailDocId(
      item ? "skill" : "skill-local",
      item?.slug ?? record?.id ?? record?.spec ?? title,
    );
    const dedupeKey = item
      ? `marketplace:${item.type}:${item.slug}`
      : `marketplace:${record?.type ?? "unknown"}:${record?.id ?? record?.spec ?? title}`;
    const typeLabel = t("marketplaceTypeSkill");

    if (!item) {
      openMarketplaceDetailDoc(docBrowser, {
        id: detailId,
        title,
        typeLabel,
        spec: record?.spec ?? "-",
        status: "ready",
        summary: t("marketplaceInstalledLocalSummary"),
        metadataRaw: JSON.stringify(record ?? {}, null, 2),
        contentRaw: "-",
      });
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
    openMarketplaceDetailDoc(docBrowser, {
      id: detailId,
      title,
      typeLabel,
      spec: item.install.spec,
      status: "loading",
      summary,
      tags: item.tags,
      author: item.author,
    });

    try {
      const content = await fetchMarketplaceSkillContent(item.slug);
      if (detailRequestRef.current.byKey.get(dedupeKey) !== requestId) {
        return;
      }
      openMarketplaceDetailDoc(
        docBrowser,
        {
          id: detailId,
          title,
          typeLabel,
          spec: item.install.spec,
          status: "ready",
          summary,
          metadataRaw: content.metadataRaw,
          contentRaw: content.bodyRaw || content.raw,
          sourceUrl: content.sourceUrl,
          sourceLabel: `Source (${content.source})`,
          tags: item.tags,
          author: item.author,
        },
        { activate: false },
      );
    } catch (error) {
      if (detailRequestRef.current.byKey.get(dedupeKey) !== requestId) {
        return;
      }
      openMarketplaceDetailDoc(
        docBrowser,
        {
          id: detailId,
          title,
          typeLabel,
          spec: item.install.spec,
          status: "error",
          summary,
          metadataRaw: JSON.stringify(
            { error: error instanceof Error ? error.message : String(error) },
            null,
            2,
          ),
          contentRaw: t("marketplaceOperationFailed"),
        },
        { activate: false },
      );
    }
  };

  return { openItemDetail };
}
