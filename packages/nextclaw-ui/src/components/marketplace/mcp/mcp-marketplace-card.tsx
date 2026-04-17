import type {
  MarketplaceInstalledRecord,
  MarketplaceItemSummary,
} from "@/api/types";
import { Button } from "@/components/ui/button";
import { TagChip } from "@/components/ui/tag-chip";
import { t } from "@/lib/i18n";
import { readSummary, readTransportLabel } from "./mcp-marketplace-doc";

export function McpMarketplaceCard(props: {
  item?: MarketplaceItemSummary;
  record?: MarketplaceInstalledRecord;
  localeFallbacks: string[];
  onOpen: () => void;
  onInstall?: () => void;
  onToggle?: () => void;
  onDoctor?: () => void;
  onRemove?: () => void;
}) {
  const {
    item,
    record,
    localeFallbacks,
    onOpen,
    onInstall,
    onToggle,
    onDoctor,
    onRemove,
  } = props;
  const installed = record;
  const name = item?.name ?? record?.label ?? record?.id ?? "MCP";
  const summary = readSummary(localeFallbacks, item, record);
  const transport = readTransportLabel(item, record);
  const status = installed
    ? installed.enabled === false
      ? t("marketplaceDisable")
      : t("statusReady")
    : null;

  return (
    <article
      onClick={onOpen}
      className="cursor-pointer rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900">{name}</div>
          <div className="mt-1 text-xs text-gray-500">{transport}</div>
          <div className="mt-2 line-clamp-2 text-sm text-gray-600">
            {summary}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(item?.tags ?? []).map((tag) => (
              <TagChip key={tag}>{tag}</TagChip>
            ))}
            {status ? <TagChip tone="success">{status}</TagChip> : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {!installed && item && onInstall ? (
            <Button
              type="button"
              size="sm"
              variant="primary"
              className="rounded-xl"
              onClick={(event) => {
                event.stopPropagation();
                onInstall();
              }}
            >
              {t("marketplaceInstall")}
            </Button>
          ) : null}

          {installed ? (
            <>
              {onToggle ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-gray-200 text-gray-700"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggle();
                  }}
                >
                  {installed.enabled === false
                    ? t("marketplaceEnable")
                    : t("marketplaceDisable")}
                </Button>
              ) : null}
              {onDoctor ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-blue-200 text-blue-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDoctor();
                  }}
                >
                  {t("marketplaceMcpDoctor")}
                </Button>
              ) : null}
              {onRemove ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove();
                  }}
                >
                  {t("marketplaceMcpRemove")}
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}
