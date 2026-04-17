import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
  MarketplaceMcpInstallSpec,
} from "@/api/types";
import {
  pickInstalledRecordDescription,
  pickLocalizedText,
} from "@/components/marketplace/marketplace-localization";
import { t } from "@/lib/i18n";

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

function escape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildDocDataUrl(
  title: string,
  metadata: string,
  content: string,
  sourceUrl?: string,
  summary?: string,
): string {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(title)}</title>
    <style>
      body { margin: 0; background: #f8fafc; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .wrap { max-width: 980px; margin: 0 auto; padding: 28px 20px 40px; }
      .hero { border: 1px solid #dbeafe; border-radius: 16px; background: linear-gradient(180deg, #eff6ff, #ffffff); padding: 20px; }
      .hero h1 { margin: 0; font-size: 26px; }
      .grid { display: grid; grid-template-columns: 280px 1fr; gap: 14px; margin-top: 16px; }
      .card { border: 1px solid #e2e8f0; background: #fff; border-radius: 14px; overflow: hidden; }
      .card h2 { margin: 0; padding: 12px 14px; font-size: 13px; font-weight: 700; color: #1d4ed8; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
      .body { padding: 12px 14px; }
      pre { margin: 0; white-space: pre-wrap; line-height: 1.7; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
      a { color: #2563eb; text-decoration: none; }
      @media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="hero">
        <h1>${escape(title)}</h1>
        ${summary ? `<p>${escape(summary)}</p>` : ""}
        ${sourceUrl ? `<p><a href="${escape(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(sourceUrl)}</a></p>` : ""}
      </section>
      <section class="grid">
        <article class="card">
          <h2>Metadata</h2>
          <div class="body"><pre>${escape(metadata)}</pre></div>
        </article>
        <article class="card">
          <h2>Content</h2>
          <div class="body"><pre>${escape(content)}</pre></div>
        </article>
      </section>
    </main>
  </body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
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
