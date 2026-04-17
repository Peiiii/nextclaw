import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
  MarketplaceManageAction,
} from "@/api/types";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  buildLocaleFallbacks,
  pickLocalizedText,
} from "@/components/marketplace/marketplace-localization";

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

function MarketplaceListCardMeta(props: {
  title: string;
  spec: string;
  summary: string;
}) {
  const { title, spec, summary } = props;

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

      <div className="mb-1.5 mt-0.5 flex items-center gap-1.5">
        {spec ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="max-w-full truncate font-mono text-[11px] text-gray-400">
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
          <p className="line-clamp-1 text-left text-[12px] leading-relaxed text-gray-500/90 transition-colors">
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

function readToggleLabel(
  busyAction: MarketplaceManageAction | undefined,
  isDisabled: boolean,
) {
  if (busyAction && busyAction !== "uninstall") {
    return busyAction === "enable"
      ? t("marketplaceEnabling")
      : t("marketplaceDisabling");
  }
  return isDisabled ? t("marketplaceEnable") : t("marketplaceDisable");
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

  return (
    <div className="flex h-full shrink-0 items-center">
      {item && !record ? (
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={(event) => {
            event.stopPropagation();
            onInstall(item);
          }}
          disabled={isInstalling}
          className="rounded-xl"
        >
          {isInstalling ? t("marketplaceInstalling") : t("marketplaceInstall")}
        </Button>
      ) : null}

      {pluginRecord ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busyForRecord}
          onClick={(event) => {
            event.stopPropagation();
            onManage(isDisabled ? "enable" : "disable", pluginRecord);
          }}
          className="rounded-xl border-gray-200/80 text-gray-600"
        >
          {readToggleLabel(busyAction, isDisabled)}
        </Button>
      ) : null}

      {record && canUninstall ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busyForRecord}
          onClick={(event) => {
            event.stopPropagation();
            onManage("uninstall", record);
          }}
          className="rounded-xl border-rose-100 text-rose-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
        >
          {busyAction === "uninstall"
            ? t("marketplaceRemoving")
            : t("marketplaceUninstall")}
        </Button>
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
      className="group flex cursor-pointer items-start justify-between gap-3.5 rounded-2xl border border-gray-200/40 bg-white px-5 py-4 shadow-sm transition-all hover:border-blue-300/80 hover:shadow-md"
    >
      <div className="flex h-full min-w-0 flex-1 items-start gap-3">
        <ItemIcon
          name={title}
          fallback={spec || t("marketplaceTypeExtension")}
        />
        <div className="flex h-full min-w-0 flex-1 flex-col justify-center">
          <MarketplaceListCardMeta
            title={title}
            spec={spec}
            summary={summary}
          />
        </div>
      </div>

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
    </article>
  );
}
