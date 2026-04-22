import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
} from "@/shared/lib/api";
import { pickLocalizedText } from "@/features/marketplace/components/marketplace-localization";

export type InstalledRenderEntry = {
  key: string;
  record: MarketplaceInstalledRecord;
  item?: MarketplaceItemSummary;
};

function normalizeMarketplaceKey(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function toLookupKey(
  type: MarketplaceItemSummary["type"],
  value: string | undefined,
): string {
  const normalized = normalizeMarketplaceKey(value);
  return normalized.length > 0 ? `${type}:${normalized}` : "";
}

export function buildCatalogLookup(
  items: MarketplaceItemSummary[],
): Map<string, MarketplaceItemSummary> {
  const lookup = new Map<string, MarketplaceItemSummary>();

  for (const item of items) {
    const candidates = [item.install.spec, item.slug, item.id];
    for (const candidate of candidates) {
      const lookupKey = toLookupKey(item.type, candidate);
      if (!lookupKey || lookup.has(lookupKey)) {
        continue;
      }
      lookup.set(lookupKey, item);
    }
  }

  return lookup;
}

export function buildInstalledRecordLookup(
  records: MarketplaceInstalledRecord[],
): Map<string, MarketplaceInstalledRecord> {
  const lookup = new Map<string, MarketplaceInstalledRecord>();

  for (const record of records) {
    const candidates = [record.spec, record.id, record.label];
    for (const candidate of candidates) {
      const lookupKey = toLookupKey(record.type, candidate);
      if (!lookupKey || lookup.has(lookupKey)) {
        continue;
      }
      lookup.set(lookupKey, record);
    }
  }

  return lookup;
}

export function findInstalledRecordForItem(
  item: MarketplaceItemSummary,
  installedRecordLookup: Map<string, MarketplaceInstalledRecord>,
): MarketplaceInstalledRecord | undefined {
  const candidates = [item.install.spec, item.slug, item.id];
  for (const candidate of candidates) {
    const lookupKey = toLookupKey(item.type, candidate);
    if (!lookupKey) {
      continue;
    }
    const record = installedRecordLookup.get(lookupKey);
    if (record) {
      return record;
    }
  }
  return undefined;
}

export function findCatalogItemForRecord(
  record: MarketplaceInstalledRecord,
  catalogLookup: Map<string, MarketplaceItemSummary>,
): MarketplaceItemSummary | undefined {
  const bySpec = catalogLookup.get(toLookupKey(record.type, record.spec));
  if (bySpec) {
    return bySpec;
  }

  const byId = catalogLookup.get(toLookupKey(record.type, record.id));
  if (byId) {
    return byId;
  }

  return catalogLookup.get(toLookupKey(record.type, record.label));
}

export function matchInstalledSearch(
  record: MarketplaceInstalledRecord,
  item: MarketplaceItemSummary | undefined,
  query: string,
  localeFallbacks: string[],
): boolean {
  const normalizedQuery = normalizeMarketplaceKey(query);
  if (!normalizedQuery) {
    return true;
  }

  const localizedSummary = pickLocalizedText(
    item?.summaryI18n,
    item?.summary,
    localeFallbacks,
  );
  const values = [
    record.id,
    record.spec,
    record.label,
    item?.name,
    item?.slug,
    item?.summary,
    localizedSummary,
    ...(item?.tags ?? []),
  ];

  return values
    .map((value) => normalizeMarketplaceKey(value))
    .filter(Boolean)
    .some((value) => value.includes(normalizedQuery));
}
