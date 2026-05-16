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
import { MarketplaceItemIcon } from "@/features/marketplace/components/marketplace-item-icon";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import {
  CheckCircle2,
  Download,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";

export type InstallState = {
  installingSpecs: ReadonlySet<string>;
};

export type ManageState = {
  actionsByTarget: ReadonlyMap<string, MarketplaceManageAction>;
};

type MarketplaceListCardActionProps = {
  item?: MarketplaceItemSummary;
  record?: MarketplaceInstalledRecord;
  pluginRecord?: MarketplaceInstalledRecord;
  isInstalling: boolean;
  isDisabled: boolean;
  canUninstall: boolean;
  busyAction?: MarketplaceManageAction;
  busyForRecord: boolean;
  language: string;
  onInstall: (item: MarketplaceItemSummary) => void;
  onManage: (
    action: MarketplaceManageAction,
    record: MarketplaceInstalledRecord,
  ) => void;
};

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

      <p className="line-clamp-2 text-left text-[12px] leading-relaxed text-gray-500/90">
        {summary}
      </p>
    </TooltipProvider>
  );
}

function MarketplaceListCardActions(props: MarketplaceListCardActionProps) {
  const {
    item,
    record,
    pluginRecord,
    isInstalling,
    isDisabled,
    canUninstall,
    busyAction,
    busyForRecord,
    language,
    onInstall,
    onManage,
  } = props;
  const hasActions = Boolean((item && !record) || pluginRecord || (record && canUninstall));

  return (
    <div
      className={cn(
        "relative flex h-8 shrink-0 items-center justify-end",
        record ? "md:w-5" : "md:w-0",
      )}
    >
      <div
        className={cn(
          "hidden items-center justify-end transition-opacity duration-150 md:flex",
          hasActions && "group-hover:opacity-0 group-focus-within:opacity-0",
        )}
      >
        {record ? (
          <MarketplaceInstalledStatusIcon
            disabled={isDisabled}
            language={language}
          />
        ) : null}
      </div>

      <div
        className={cn(
          "flex w-max items-center justify-end gap-2 transition-opacity duration-150",
          "opacity-100 md:pointer-events-none md:absolute md:right-0 md:opacity-0",
          "md:group-hover:pointer-events-auto md:group-hover:opacity-100",
          "md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100",
        )}
      >
        {item && !record && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onInstall(item);
            }}
            disabled={isInstalling}
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-3 text-xs font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
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
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-xl border border-gray-200/80 bg-white px-3 text-xs font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            {isDisabled ? (
              <Power className="h-3.5 w-3.5" />
            ) : (
              <PowerOff className="h-3.5 w-3.5" />
            )}
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
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-xl border border-gray-200/80 bg-white px-3 text-xs font-medium text-gray-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {busyAction === "uninstall"
              ? t("marketplaceRemoving")
              : t("marketplaceUninstall")}
          </button>
        )}
      </div>
    </div>
  );
}

function MarketplaceInstalledStatusIcon(props: {
  disabled: boolean;
  language: string;
}) {
  const { disabled, language } = props;
  const label = disabled
    ? readLocalized({ zh: "已禁用", en: "Disabled" }, language)
    : readLocalized({ zh: "已安装", en: "Installed" }, language);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-label={label}
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center",
              disabled ? "text-gray-400" : "text-emerald-700",
            )}
          >
            {disabled ? (
              <PowerOff className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent className="text-xs">{label}</TooltipContent>
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
        <MarketplaceItemIcon
          name={title}
          fallback={spec || t("marketplaceTypeExtension")}
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <MarketplaceListCardMeta title={title} spec={spec} summary={summary} />
        </div>
      </div>

      <MarketplaceListCardActions
        item={item}
        record={record}
        pluginRecord={pluginRecord}
        isInstalling={isInstalling}
        isDisabled={isDisabled}
        canUninstall={canUninstall}
        busyAction={busyAction}
        busyForRecord={busyForRecord}
        language={language}
        onInstall={onInstall}
        onManage={onManage}
      />
    </article>
  );
}

function readLocalized(text: { zh: string; en: string }, language: string) {
  return language.startsWith("zh") ? text.zh : text.en;
}
