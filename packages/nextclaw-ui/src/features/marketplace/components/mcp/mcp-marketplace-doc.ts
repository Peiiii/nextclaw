import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
  MarketplaceMcpInstallSpec,
} from "@/shared/lib/api";
import {
  pickInstalledRecordDescription,
  pickLocalizedText,
} from "@/features/marketplace/components/marketplace-localization";
import { t } from "@/shared/lib/i18n";

function normalizeMarketplaceKey(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function buildInstalledRecordLookup(
  records: MarketplaceInstalledRecord[],
): Map<string, MarketplaceInstalledRecord> {
  const lookup = new Map<string, MarketplaceInstalledRecord>();

  for (const record of records) {
    const candidates = [
      record.catalogSlug,
      record.spec,
      record.id,
      record.label,
    ];
    for (const candidate of candidates) {
      const normalized = normalizeMarketplaceKey(candidate);
      if (!normalized || lookup.has(normalized)) {
        continue;
      }
      lookup.set(normalized, record);
    }
  }

  return lookup;
}

export function findInstalledRecordForItem(
  item: MarketplaceItemSummary,
  installedRecordLookup: Map<string, MarketplaceInstalledRecord>,
): MarketplaceInstalledRecord | undefined {
  const candidates = [item.slug, item.install.spec, item.id, item.name];
  for (const candidate of candidates) {
    const normalized = normalizeMarketplaceKey(candidate);
    if (!normalized) {
      continue;
    }
    const record = installedRecordLookup.get(normalized);
    if (record) {
      return record;
    }
  }
  return undefined;
}

export function readSummary(
  localeFallbacks: string[],
  item?: MarketplaceItemSummary,
  record?: MarketplaceInstalledRecord,
): string {
  const localizedSummary = pickLocalizedText(
    item?.summaryI18n,
    item?.summary,
    localeFallbacks,
  );
  if (localizedSummary) {
    return localizedSummary;
  }

  const localizedRecordDescription = pickInstalledRecordDescription(
    record,
    localeFallbacks,
  );
  return localizedRecordDescription || t("marketplaceInstalledLocalSummary");
}

export function readTransportLabel(
  item?: MarketplaceItemSummary,
  record?: MarketplaceInstalledRecord,
): string {
  if (record?.transport) {
    return record.transport.toUpperCase();
  }
  const install = item?.install as MarketplaceMcpInstallSpec | undefined;
  return (
    (install?.transportTypes ?? [])
      .map((entry) => entry.toUpperCase())
      .join(" / ") || "MCP"
  );
}
