import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
  MarketplaceManageAction,
} from "@/shared/lib/api";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import {
  buildLocaleFallbacks,
  pickLocalizedText,
} from "@/features/marketplace/components/marketplace-localization";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

export type InstallState = {
  installingSpecs: ReadonlySet<string>;
};

export type ManageState = {
  actionsByTarget: ReadonlyMap<string, MarketplaceManageAction>;
};

const ITEM_ICON_COLORS = [
  "bg-amber-600",
  "bg-orange-500",
  "bg-yellow-600",
  "bg-emerald-600",
  "bg-teal-600",
  "bg-cyan-600",
  "bg-stone-600",
  "bg-rose-500",
  "bg-violet-500",
] as const;

function getAvatarColor(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ITEM_ICON_COLORS[Math.abs(hash) % ITEM_ICON_COLORS.length];
}

function ItemIcon({ name, fallback }: { name?: string; fallback: string }) {
  const displayName = name || fallback;
  const letters = displayName.substring(0, 2).toUpperCase();
  const colorClass = getAvatarColor(displayName);

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white",
        colorClass,
      )}
    >
      {letters}
    </div>
  );
}

function MarketplaceListCardMeta({
  title,
  spec,
  summary,
}: {
  title: string;
  spec: string;
  summary: string;
}) {
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="truncate text-[14px] font-semibold leading-tight text-gray-900">
            {title}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[300px] text-xs">
          {title}
        </TooltipContent>
      </Tooltip>

      <div className="mb-1.5 mt-0.5 flex min-w-0 items-center gap-1.5">
        {spec ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="max-w-full truncate text-[11px] font-mono text-gray-400">
                {spec}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px] break-all font-mono text-xs">
              {spec}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <p className="line-clamp-1 text-left text-[12px] leading-relaxed text-gray-500/90">
            {summary}
          </p>
        </TooltipTrigger>
        {summary ? (
          <TooltipContent className="max-w-[400px] text-xs leading-relaxed">
            {summary}
          </TooltipContent>
        ) : null}
      </Tooltip>
    </TooltipProvider>
  );
}

export function MarketplaceListCard(props: {
  item?: MarketplaceItemSummary;
  record?: MarketplaceInstalledRecord;
  language: string;
  installState: InstallState;
  manageState: ManageState;
  onOpen: () => void;
  onInstall: (item: MarketplaceItemSummary) => void;
  onManage: (
    action: MarketplaceManageAction,
    record: MarketplaceInstalledRecord,
  ) => void;
}) {
  const {
    item,
    record,
    language,
    installState,
    manageState,
    onOpen,
    onInstall,
    onManage,
  } = props;
  const localeFallbacks = buildLocaleFallbacks(language);
  const pluginRecord = record?.type === "plugin" ? record : undefined;
  const title =
    item?.name ??
    record?.label ??
    record?.id ??
    record?.spec ??
    t("marketplaceUnknownItem");
  const summary =
    pickLocalizedText(item?.summaryI18n, item?.summary, localeFallbacks) ||
    (record ? t("marketplaceInstalledLocalSummary") : "");
  const spec = item?.install.spec ?? record?.spec ?? "";
  const targetId = record?.id || record?.spec;
  const busyAction = targetId
    ? manageState.actionsByTarget.get(targetId)
    : undefined;
  const busyForRecord = Boolean(busyAction);
  const canUninstall =
    (record?.type === "plugin" && record.origin !== "bundled") ||
    (record?.type === "skill" && record.source === "workspace");
  const isDisabled = record
    ? record.enabled === false || record.runtimeStatus === "disabled"
    : false;
  const installSpec = item?.install.spec;
  const isInstalling =
    typeof installSpec === "string" &&
    installState.installingSpecs.has(installSpec);

  return (
    <article
      onClick={onOpen}
      className="group flex cursor-pointer items-start justify-between gap-3.5 rounded-2xl border border-gray-200/40 bg-white px-5 py-4 shadow-sm transition-all hover:border-blue-300/80 hover:shadow-md"
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <ItemIcon
          name={title}
          fallback={spec || t("marketplaceTypeExtension")}
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <MarketplaceListCardMeta title={title} spec={spec} summary={summary} />
        </div>
      </div>

      <div className="flex h-full shrink-0 items-center">
        {item && !record && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onInstall(item);
            }}
            disabled={isInstalling}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
          >
            {isInstalling ? t("marketplaceInstalling") : t("marketplaceInstall")}
          </button>
        )}

        {pluginRecord && (
          <button
            disabled={busyForRecord}
            onClick={(event) => {
              event.stopPropagation();
              onManage(isDisabled ? "enable" : "disable", pluginRecord);
            }}
            className="inline-flex h-8 items-center rounded-xl border border-gray-200/80 bg-white px-4 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            {busyAction && busyAction !== "uninstall"
              ? busyAction === "enable"
                ? t("marketplaceEnabling")
                : t("marketplaceDisabling")
              : isDisabled
                ? t("marketplaceEnable")
                : t("marketplaceDisable")}
          </button>
        )}

        {record && canUninstall && (
          <button
            disabled={busyForRecord}
            onClick={(event) => {
              event.stopPropagation();
              onManage("uninstall", record);
            }}
            className="inline-flex h-8 items-center rounded-xl border border-rose-100 bg-white px-4 text-xs font-medium text-rose-500 transition-colors hover:border-rose-200 hover:bg-rose-50 disabled:opacity-50"
          >
            {busyAction === "uninstall"
              ? t("marketplaceRemoving")
              : t("marketplaceUninstall")}
          </button>
        )}
      </div>
    </article>
  );
}
