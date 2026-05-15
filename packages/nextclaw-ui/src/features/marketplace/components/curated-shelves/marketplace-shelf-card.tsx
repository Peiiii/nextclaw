import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
} from "@/shared/lib/api";
import type { InstallState } from "@/features/marketplace/components/marketplace-list-card";
import { MarketplaceItemIcon } from "@/features/marketplace/components/marketplace-item-icon";
import { pickLocalizedText } from "@/features/marketplace/components/marketplace-localization";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { CheckCircle2, Download } from "lucide-react";

type SkillShelfCardEntry = {
  item: MarketplaceItemSummary;
  record?: MarketplaceInstalledRecord;
};

export function SkillShelfCard(props: {
  entry: SkillShelfCardEntry;
  language: string;
  localeFallbacks: string[];
  installState: InstallState;
  layout?: "rail" | "grid";
  onOpen: (entry: SkillShelfCardEntry) => void;
  onInstall: (item: MarketplaceItemSummary) => void;
}) {
  const {
    entry,
    language,
    localeFallbacks,
    installState,
    layout = "rail",
    onOpen,
    onInstall,
  } = props;
  const { item, record } = entry;
  const summary = pickLocalizedText(item.summaryI18n, item.summary, localeFallbacks);
  const installSpec = item.install.spec;
  const isInstalling = installState.installingSpecs.has(installSpec);
  const isInstalled = Boolean(record);

  return (
    <article
      onClick={() => onOpen(entry)}
      className={cn(
        "group flex min-h-[166px] cursor-pointer flex-col justify-between rounded-xl border border-gray-200/70 bg-white p-3 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50/60",
        layout === "rail" ? "w-[260px] shrink-0" : "w-full min-w-0",
      )}
    >
      <div>
        <div className="mb-2.5 flex min-w-0 items-start gap-2.5">
          <MarketplaceItemIcon name={item.name} fallback={item.install.spec} />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="truncate text-[13px] font-semibold leading-tight text-gray-950">
              {item.name}
            </div>
            <div className="mt-0.5 truncate text-[11px] font-mono leading-tight text-gray-400">
              {formatShelfMeta(item)}
            </div>
          </div>
        </div>
        <p className="line-clamp-2 text-[12px] leading-relaxed text-gray-500">
          {summary}
        </p>
        <TagLine tags={item.tags} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-2.5">
        <span className="min-w-0 truncate text-[11px] text-gray-400">
          {formatUpdatedAt(item.updatedAt)}
        </span>
        {isInstalled ? (
          <span className="inline-flex h-7 items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {readLocalized({ zh: "已安装", en: "Installed" }, language)}
          </span>
        ) : (
          <button
            type="button"
            disabled={isInstalling}
            onClick={(event) => {
              event.stopPropagation();
              onInstall(item);
            }}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 text-[11px] font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {isInstalling ? t("marketplaceInstalling") : t("marketplaceInstall")}
          </button>
        )}
      </div>
    </article>
  );
}

function formatShelfMeta(item: MarketplaceItemSummary) {
  return item.slug || item.install.spec;
}

function TagLine({ tags }: { tags: string[] }) {
  const visibleTags = tags.slice(0, 2);
  if (visibleTags.length === 0) {
    return null;
  }
  return (
    <div className="mt-2 truncate text-[11px] font-medium text-gray-400">
      {visibleTags.join(" / ")}
    </div>
  );
}

function formatUpdatedAt(value: string) {
  const date = value.slice(0, 10);
  return date || value;
}

function readLocalized(text: { zh: string; en: string }, language: string) {
  return language.startsWith("zh") ? text.zh : text.en;
}
