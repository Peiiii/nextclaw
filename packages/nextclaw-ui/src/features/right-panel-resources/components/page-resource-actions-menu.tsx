import { MoreVertical } from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
} from "@/shared/components/ui/context-menu/context-menu";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import { usePageResourceActions } from "@/features/right-panel-resources/hooks/use-page-resource-actions";
import type { PageResource } from "@/features/right-panel-resources/types/page-resource.types";
import { cn } from "@/shared/lib/utils";
import { t } from "@/shared/lib/i18n";

export function PageResourceActionsMenu({
  page,
  revealOnHover = false,
}: {
  page: PageResource;
  revealOnHover?: boolean;
}) {
  const actions = usePageResourceActions();
  return (
    <ContextMenu groups={actions(page)} label={t("pageActions")}>
      <span
        className={cn(
          "inline-flex",
          revealOnHover &&
            "pointer-events-none opacity-0 transition-opacity group-hover/page-row:pointer-events-auto group-hover/page-row:opacity-100 group-focus-within/page-row:pointer-events-auto group-focus-within/page-row:opacity-100 data-[context-menu-open]:pointer-events-auto data-[context-menu-open]:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100",
        )}
      >
        <ContextMenuTrigger>
          <IconActionButton
            icon={<MoreVertical className="h-4 w-4" />}
            label={t("pageActions")}
            size="sm"
          />
        </ContextMenuTrigger>
      </span>
    </ContextMenu>
  );
}

export function PageResourceActionItems({
  page,
  onSelect,
}: {
  page: PageResource;
  onSelect?: () => void;
}) {
  const actions = usePageResourceActions();
  return (
    <>
      {actions(page)
        .flatMap((group) => group.items)
        .map((item) => (
          <button
            key={item.key}
            type="button"
            disabled={item.disabled}
            aria-pressed={item.pressed}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            onClick={() => {
              onSelect?.();
              item.onSelect?.();
            }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
    </>
  );
}
