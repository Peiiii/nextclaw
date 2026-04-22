/* eslint-disable max-lines-per-function */
import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
  MarketplaceManageAction,
} from "@/shared/lib/api";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import {
  buildLocaleFallbacks,
  pickLocalizedText,
} from "@/features/marketplace/components/marketplace-localization";
import { Check, Download, Power, PowerOff, Trash2 } from "lucide-react";

export type InstallState = {
  installingSpecs: ReadonlySet<string>;
};

export type ManageState = {
  actionsByTarget: ReadonlyMap<string, MarketplaceManageAction>;
};

const ITEM_ICON_COLORS = [
  "from-amber-400 to-amber-600 shadow-amber-500/25",
  "from-orange-400 to-orange-500 shadow-orange-500/25",
  "from-yellow-400 to-yellow-600 shadow-yellow-500/25",
  "from-emerald-400 to-emerald-600 shadow-emerald-500/25",
  "from-teal-400 to-teal-600 shadow-teal-500/25",
  "from-cyan-400 to-cyan-600 shadow-cyan-500/25",
  "from-slate-400 to-slate-600 shadow-slate-500/25",
  "from-rose-400 to-rose-500 shadow-rose-500/25",
  "from-indigo-400 to-indigo-600 shadow-indigo-500/25",
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
    <div className="relative shrink-0 perspective-1000">
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-[14px]",
          "text-[18px] font-bold tracking-tight text-white/95",
          "bg-gradient-to-br shadow-md ring-1 ring-white/30 inset-0 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-[2deg]",
          colorClass,
        )}
      >
        {letters}
      </div>
    </div>
  );
}

function MarketplaceListCardMeta(props: {
  title: string;
  spec: string;
  summary: string;
  tags?: string[];
}) {
  const { title, spec, summary, tags } = props;

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="truncate text-[15px] font-bold tracking-tight text-gray-900 group-hover:text-primary transition-colors">
            {title}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[300px] text-xs">
          {title}
        </TooltipContent>
      </Tooltip>

      <div className="mb-1.5 mt-0.5 flex flex-wrap items-center gap-1.5 min-w-0">
        {spec ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate bg-gray-100/80 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-gray-500 whitespace-nowrap">
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
          <p className="line-clamp-2 text-left text-[12.5px] leading-[1.4] text-gray-500/90 group-hover:text-gray-600 transition-colors">
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

function MarketplaceListCardActions(props: {
  item?: MarketplaceItemSummary;
  record?: MarketplaceInstalledRecord;
  isInstalling: boolean;
  busyAction: MarketplaceManageAction | undefined;
  busyForRecord: boolean;
  isDisabled: boolean;
  onInstall: (item: MarketplaceItemSummary) => void;
  onManage: (
    action: MarketplaceManageAction,
    record: MarketplaceInstalledRecord,
  ) => void;
}) {
  const {
    item,
    record,
    isInstalling,
    busyAction,
    busyForRecord,
    isDisabled,
    onInstall,
    onManage,
  } = props;
  const pluginRecord = record?.type === "plugin" ? record : undefined;
  const canUninstall =
    (record?.type === "plugin" && record.origin !== "bundled") ||
    (record?.type === "skill" && record.source === "workspace");
  const manageLabel =
    busyAction === "enable"
      ? t("marketplaceEnabling")
      : busyAction === "disable"
        ? t("marketplaceDisabling")
        : isDisabled
          ? t("marketplaceEnable")
          : t("marketplaceDisable");

  return (
    <div className="flex shrink-0 items-center gap-2">
      {item && !record ? (
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={(event: React.MouseEvent) => {
            event.stopPropagation();
            onInstall(item);
          }}
          disabled={isInstalling}
          className="rounded-full px-4 font-semibold text-xs h-8 shadow-sm transition-all hover:shadow-md hover:scale-105 active:scale-95"
        >
          {isInstalling ? (
            <span className="flex items-center gap-1.5">
              <span className="animate-spin border-2 border-white/20 border-t-white h-3 w-3 rounded-full" />
              {t("marketplaceInstalling")}
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              {t("marketplaceInstall")}
            </span>
          )}
        </Button>
      ) : null}

      {pluginRecord ? (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant={isDisabled ? "outline" : "secondary"}
                aria-label={manageLabel}
                disabled={busyForRecord}
                onClick={(event: React.MouseEvent) => {
                  event.stopPropagation();
                  onManage(isDisabled ? "enable" : "disable", pluginRecord);
                }}
                className={cn(
                  "rounded-full h-8 w-8 transition-colors border",
                  isDisabled 
                    ? "border-gray-200 text-gray-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50" 
                    : "bg-emerald-50 text-emerald-600 border-transparent hover:bg-emerald-100 hover:text-emerald-700"
                )}
              >
                {isDisabled ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                <span className="sr-only">{manageLabel}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              {manageLabel}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}

      {record && !canUninstall && item ? (
        <div className="flex h-8 items-center rounded-full bg-gray-100 px-3 text-[11px] font-semibold text-gray-500 shadow-inner">
          <Check className="mr-1 h-3 w-3" />
          {t("marketplaceTabInstalledPlugins").replace(" Plugins", "")}
        </div>
      ) : null}

      {record && canUninstall ? (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={busyForRecord}
                onClick={(event: React.MouseEvent) => {
                  event.stopPropagation();
                  onManage("uninstall", record);
                }}
                className="rounded-full h-8 w-8 border-gray-100 text-gray-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              {busyAction === "uninstall"
                ? t("marketplaceRemoving")
                : t("marketplaceUninstall")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
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
      className={cn(
        "group relative flex cursor-pointer flex-col justify-between gap-4 rounded-[20px] bg-white px-5 py-5",
        "border border-gray-950/[0.04] shadow-sm transform-gpu transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-[0_12px_24px_rgb(0,0,0,0.06)] hover:border-primary/20",
        isDisabled && "opacity-80 grayscale-[30%] hover:grayscale-0",
      )}
    >
      <div className="flex min-w-0 items-start gap-4">
        <ItemIcon
          name={title}
          fallback={spec || t("marketplaceTypeExtension")}
        />
        <div className="flex min-w-0 flex-1 flex-col justify-start pb-2">
          <MarketplaceListCardMeta
            title={title}
            spec={spec}
            summary={summary}
            tags={item?.tags}
          />
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-auto border-t border-gray-100/80 pt-3">
        <span className="text-[11px] font-medium text-gray-400">
          {item?.author || (record?.type === "plugin" ? record.origin : "-")}
        </span>
        <MarketplaceListCardActions
          item={item}
          record={record}
          isInstalling={isInstalling}
          busyAction={busyAction}
          busyForRecord={busyForRecord}
          isDisabled={isDisabled}
          onInstall={onInstall}
          onManage={onManage}
        />
      </div>
    </article>
  );
}
