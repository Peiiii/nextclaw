import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
  MarketplaceManageAction,
} from "@/shared/lib/api";
import { useI18n } from "@/app/components/i18n-provider";
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
  RefreshCw,
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
  state: {
    isInstalling: boolean;
    canUpdate: boolean;
    canUninstall: boolean;
    busyAction?: MarketplaceManageAction;
  };
  onInstall: (item: MarketplaceItemSummary) => void;
  onManage: (
    action: MarketplaceManageAction,
    record: MarketplaceInstalledRecord,
  ) => void;
};

function MarketplaceListCardMeta({
  title,
  spec,
}: {
  title: string;
  spec: string;
}) {
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="truncate text-[14px] font-semibold leading-tight text-gray-950">
            {title}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[300px] text-xs">
          {title}
        </TooltipContent>
      </Tooltip>

      <div className="mb-2 mt-1 flex min-w-0 items-center gap-1.5">
        {spec ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="max-w-full truncate text-[11px] font-mono leading-tight text-gray-400">
                {spec}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px] break-all font-mono text-xs">
              {spec}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

function MarketplaceListCardActionButtons(props: MarketplaceListCardActionProps) {
  const {
    item,
    record,
    state,
    onInstall,
    onManage,
  } = props;
  const {
    isInstalling,
    canUpdate,
    canUninstall,
    busyAction,
  } = state;
  const busyForRecord = Boolean(busyAction);
  const hasActions = Boolean((item && !record) || (record && (canUpdate || canUninstall)));
  if (!hasActions) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-end gap-1.5 opacity-100 transition-opacity duration-150",
        "md:pointer-events-none md:opacity-0",
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
          className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md bg-primary px-2 text-[11px] font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
        >
          <Download className="h-3 w-3" />
          {isInstalling ? t("marketplaceInstalling") : t("marketplaceInstall")}
        </button>
      )}

      {record && canUpdate && (
        <button
          disabled={busyForRecord}
          onClick={(event) => {
            event.stopPropagation();
            onManage("update", record);
          }}
          className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md border border-blue-200/80 bg-white px-2 text-[11px] font-medium text-blue-600 transition-colors hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
        >
          <RefreshCw className="h-3 w-3" />
          {busyAction === "update"
            ? t("marketplaceUpdating")
            : t("marketplaceUpdate")}
        </button>
      )}

      {record && canUninstall && (
        <button
          disabled={busyForRecord}
          onClick={(event) => {
            event.stopPropagation();
            onManage("uninstall", record);
          }}
          className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md border border-gray-200/80 bg-white px-2 text-[11px] font-medium text-gray-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
        >
          <Trash2 className="h-3 w-3" />
          {busyAction === "uninstall"
            ? t("marketplaceRemoving")
            : t("marketplaceUninstall")}
        </button>
      )}
    </div>
  );
}

function MarketplaceListCardStatus(props: {
  record?: MarketplaceInstalledRecord;
  disabled: boolean;
}) {
  const { record, disabled } = props;
  if (!record) {
    return null;
  }
  return (
    <div className="flex h-5 w-5 shrink-0 items-center justify-end">
      <MarketplaceInstalledStatusIcon disabled={disabled} />
    </div>
  );
}

function MarketplaceInstalledStatusIcon(props: { disabled: boolean }) {
  const { disabled } = props;
  const label = disabled
    ? t("marketplaceDisabledStatus")
    : t("marketplaceInstalledStatus");

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
              <CheckCircle2 className="h-4 w-4 opacity-40" />
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
    installState,
    manageState,
    onOpen,
    onInstall,
    onManage,
  } = props;
  const { language } = useI18n();
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
  const tags = item?.tags ?? [];
  const targetId = record?.id || record?.spec;
  const busyAction = targetId
    ? manageState.actionsByTarget.get(targetId)
    : undefined;
  const canUninstall = record?.type === "skill" && record.source === "workspace";
  const canUpdate = record?.type === "skill" && record.origin === "marketplace";
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
      className="group flex h-full min-h-[156px] cursor-pointer flex-col rounded-xl border border-gray-200/60 bg-white p-3.5 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50/60"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <MarketplaceItemIcon
          name={title}
          fallback={spec || t("marketplaceTypeSkill")}
          className="h-9 w-9 rounded-lg text-xs"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <MarketplaceListCardMeta title={title} spec={spec} />
        </div>

        <MarketplaceListCardStatus record={record} disabled={isDisabled} />
      </div>

      <div className="mt-2 flex min-w-0 flex-1 flex-col">
        <p className="line-clamp-2 text-left text-[12px] leading-relaxed text-gray-500">
          {summary}
        </p>

        <div className="mt-auto flex min-w-0 items-end justify-between gap-2 pt-2">
          <div className="min-w-0 flex-1">
            <MarketplaceListCardTags tags={tags} />
          </div>
          <MarketplaceListCardActionButtons
            item={item}
            record={record}
            state={{
              isInstalling,
              canUpdate,
              canUninstall,
              busyAction,
            }}
            onInstall={onInstall}
            onManage={onManage}
          />
        </div>
      </div>
    </article>
  );
}

function MarketplaceListCardTags({ tags }: { tags: string[] }) {
  const visibleTags = tags.filter(isVisibleMarketplaceTag).slice(0, 3);
  if (visibleTags.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5 overflow-hidden">
      {visibleTags.map((tag) => (
        <span
          key={tag}
          className="max-w-[104px] truncate rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium leading-5 text-gray-500"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function isVisibleMarketplaceTag(tag: string) {
  const normalized = tag.trim().toLowerCase();
  return normalized.length > 0 && normalized !== "skill";
}
