import type { ButtonHTMLAttributes, PointerEvent, ReactElement } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Maximize2,
  PanelRightOpen,
  Pin,
  PinOff,
  Plus,
  X,
} from "lucide-react";
import type { DocBrowserDockState, DocBrowserTab } from "./doc-browser-context";
import { cn } from "@/shared/lib/utils";
import { t } from "@/shared/lib/i18n";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

type DocBrowserTabStripProps = {
  tabs: DocBrowserTab[];
  activeTabId: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isDocked: boolean;
  isFullscreen: boolean;
  dockState?: DocBrowserDockState;
  onGoBack: () => void;
  onGoForward: () => void;
  onOpenNewTab: () => void;
  onToggleDock?: () => void;
  onSetActiveTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onClose: () => void;
  onDragStart: (event: PointerEvent<HTMLElement>) => void;
  onToggleMode: () => void;
};

type DocBrowserIconActionButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "type"
> & {
  disabled?: boolean;
  icon: ReactElement;
  label: string;
  variant?: "tab" | "toolbar";
};

function DocBrowserIconActionButton({
  className,
  disabled = false,
  icon,
  label,
  variant = "toolbar",
  ...buttonProps
}: DocBrowserIconActionButtonProps) {
  const button = (
    <button
      {...buttonProps}
      type="button"
      disabled={disabled}
      className={cn(
        variant === "toolbar"
          ? "rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:text-gray-300 disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-gray-300"
          : "rounded p-0.5 transition-colors hover:bg-black/10",
        className,
      )}
      aria-label={label}
    >
      {icon}
    </button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {disabled ? <span className="inline-flex">{button}</span> : button}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function DocBrowserTabStrip({
  tabs,
  activeTabId,
  canGoBack,
  canGoForward,
  isDocked,
  isFullscreen,
  dockState,
  onGoBack,
  onGoForward,
  onOpenNewTab,
  onToggleDock,
  onSetActiveTab,
  onCloseTab,
  onClose,
  onDragStart,
  onToggleMode,
}: DocBrowserTabStripProps) {
  const backLabel = t("docBrowserBack");
  const closeLabel = t("docBrowserClose");
  const closeTabLabel = t("docBrowserCloseTab");
  const dockLabel = dockState?.isDocked
    ? dockState.removable
      ? t("sideDockUnpinCurrent")
      : t("sideDockBuiltInDocked")
    : t("sideDockPinCurrent");
  const forwardLabel = t("docBrowserForward");
  const modeLabel = isDocked
    ? t("docBrowserFloatMode")
    : t("docBrowserDockMode");
  const newTabLabel = t("docBrowserNewTab");

  return (
    <TooltipProvider delayDuration={250}>
      <div
        data-testid="doc-browser-tab-strip"
        className={cn(
          "flex h-11 items-stretch gap-2 px-2.5 bg-background border-b border-[#f1e7d4] shrink-0 select-none",
          isFullscreen &&
            "h-[calc(env(safe-area-inset-top,0px)+2.75rem)] pt-[env(safe-area-inset-top,0px)]",
        )}
        onPointerDown={!isDocked && !isFullscreen ? onDragStart : undefined}
      >
        <div
          className="doc-browser-tab-scrollbar flex h-full min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                className={cn(
                  "inline-flex items-center gap-1 h-7 px-1.5 rounded-lg text-xs border max-w-[220px] shrink-0 transition-colors",
                  isActive
                    ? "bg-amber-50/80 border-amber-200 text-amber-900 shadow-[0_1px_2px_rgba(30,20,10,0.04)]"
                    : "bg-[#f9f8f5] border-[#eee3d1] text-[#78644d] hover:bg-[#fff7ea] hover:text-[#2f2212]",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSetActiveTab(tab.id)}
                  className="truncate text-left px-1"
                  title={tab.title}
                >
                  {tab.title || t("docBrowserTabUntitled")}
                </button>
                <DocBrowserIconActionButton
                  icon={<X className="w-3 h-3" />}
                  label={closeTabLabel}
                  variant="tab"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                />
              </div>
            );
          })}
        </div>
        <div
          className="flex h-full items-center gap-1 shrink-0"
          data-testid="doc-browser-tab-actions"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <DocBrowserIconActionButton
            disabled={!canGoBack}
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
            label={backLabel}
            onClick={onGoBack}
          />
          <DocBrowserIconActionButton
            disabled={!canGoForward}
            icon={<ArrowRight className="w-3.5 h-3.5" />}
            label={forwardLabel}
            onClick={onGoForward}
          />
          <DocBrowserIconActionButton
            icon={<Plus className="w-3.5 h-3.5" />}
            label={newTabLabel}
            onClick={onOpenNewTab}
          />
          {dockState?.canDock ? (
            <DocBrowserIconActionButton
              disabled={dockState.isDocked && !dockState.removable}
              icon={
                dockState.isDocked && dockState.removable ? (
                  <PinOff className="w-3.5 h-3.5" />
                ) : (
                  <Pin className="w-3.5 h-3.5" />
                )
              }
              label={dockLabel}
              onClick={onToggleDock}
            />
          ) : null}
          {!isFullscreen ? (
            <DocBrowserIconActionButton
              icon={
                isDocked ? (
                  <Maximize2 className="w-3.5 h-3.5" />
                ) : (
                  <PanelRightOpen className="w-3.5 h-3.5" />
                )
              }
              label={modeLabel}
              onClick={onToggleMode}
            />
          ) : null}
          <DocBrowserIconActionButton
            icon={<X className="w-3.5 h-3.5" />}
            label={closeLabel}
            onClick={onClose}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
