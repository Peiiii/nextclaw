import {
  ArrowUpRight,
  Maximize2,
  Minimize2,
  Minus,
  PanelRight,
  PictureInPicture2,
  X,
} from "lucide-react";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import { t } from "@/shared/lib/i18n";
import type { WorkbenchSurfaceState } from "./types/workbench-surface.types";

export function WorkbenchSurfaceToolbar({
  state,
  compact,
  onPlace,
  onMinimize,
  onRestore,
  onMaximize,
  onClose,
  closeLabel,
  onOpenMain,
}: {
  state: WorkbenchSurfaceState;
  compact: boolean;
  onPlace?: () => void;
  onMinimize: () => void;
  onRestore: () => void;
  onMaximize: () => void;
  onClose: () => void;
  closeLabel: string;
  onOpenMain?: () => void;
}) {
  return (
    <div
      className="flex shrink-0 items-center gap-0.5"
      data-workbench-actions=""
    >
      {onOpenMain && (
        <IconActionButton
          size="sm"
          icon={<ArrowUpRight className="h-4 w-4" />}
          label={t("workbenchOpenMain")}
          onClick={onOpenMain}
        />
      )}
      {!compact && onPlace && (
        <IconActionButton
          size="sm"
          icon={
            state.placement === "floating" ? (
              <PanelRight className="h-4 w-4" />
            ) : (
              <PictureInPicture2 className="h-4 w-4" />
            )
          }
          label={t(
            state.placement === "floating"
              ? "workbenchDock"
              : "workbenchFloatGroup",
          )}
          onClick={onPlace}
        />
      )}
      <IconActionButton
        size="sm"
        icon={
          state.minimized ? (
            <Maximize2 className="h-4 w-4" />
          ) : (
            <Minus className="h-4 w-4" />
          )
        }
        label={t(state.minimized ? "workbenchExpand" : "workbenchCollapse")}
        onClick={state.minimized ? onRestore : onMinimize}
      />
      {!compact && !state.minimized && (
        <IconActionButton
          size="sm"
          icon={
            state.maximized ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )
          }
          label={t(
            state.maximized ? "workbenchRestoreSize" : "workbenchMaximize",
          )}
          onClick={onMaximize}
        />
      )}
      <IconActionButton
        size="sm"
        icon={<X className="h-4 w-4" />}
        label={closeLabel}
        onClick={onClose}
      />
    </div>
  );
}
