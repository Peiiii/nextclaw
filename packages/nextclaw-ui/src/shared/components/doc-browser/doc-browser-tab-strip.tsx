import type { PointerEvent } from "react";
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
import {
  CompactTabStrip,
  type CompactTabStripAction,
  type CompactTabStripTab,
} from "@/shared/components/ui/tabs";
import { cn } from "@/shared/lib/utils";
import { t } from "@/shared/lib/i18n";

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
  const modeLabel = isDocked ? t("docBrowserFloatMode") : t("docBrowserDockMode");
  const newTabLabel = t("docBrowserNewTab");
  const compactTabs: CompactTabStripTab[] = tabs.map((tab) => ({
    key: tab.id,
    label: tab.title || t("docBrowserTabUntitled"),
    active: tab.id === activeTabId,
    tooltip: tab.title,
    closeLabel: closeTabLabel,
    closePlacement: "trailing",
    onSelect: () => onSetActiveTab(tab.id),
    onClose: () => onCloseTab(tab.id),
  }));
  const actions: CompactTabStripAction[] = [
    { key: "back", disabled: !canGoBack, icon: <ArrowLeft className="h-3.5 w-3.5" />, label: backLabel, onClick: onGoBack },
    { key: "forward", disabled: !canGoForward, icon: <ArrowRight className="h-3.5 w-3.5" />, label: forwardLabel, onClick: onGoForward },
    { key: "new-tab", icon: <Plus className="h-3.5 w-3.5" />, label: newTabLabel, onClick: onOpenNewTab },
    ...(dockState?.canDock
      ? [
          {
            key: "dock",
            disabled: dockState.isDocked && !dockState.removable,
            icon: dockState.isDocked && dockState.removable ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />,
            label: dockLabel,
            onClick: () => onToggleDock?.(),
          },
        ]
      : []),
    ...(!isFullscreen
      ? [
          {
            key: "mode",
            icon: isDocked ? <Maximize2 className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />,
            label: modeLabel,
            onClick: onToggleMode,
          },
        ]
      : []),
    { key: "close", icon: <X className="h-3.5 w-3.5" />, label: closeLabel, onClick: onClose },
  ];

  return (
    <CompactTabStrip
      testId="doc-browser-tab-strip"
      actionsTestId="doc-browser-tab-actions"
      tabs={compactTabs}
      actions={actions}
      className={cn(
        "h-11 gap-2 px-2.5 bg-background border-[#f1e7d4] shrink-0 select-none",
        isFullscreen && "h-[calc(env(safe-area-inset-top,0px)+2.75rem)] pt-[env(safe-area-inset-top,0px)]",
      )}
      scrollClassName="doc-browser-tab-scrollbar flex h-full items-center gap-1.5"
      tabsClassName="items-center gap-1.5"
      actionsClassName="h-full items-center gap-1"
      actionButtonClassName="rounded-md p-1.5 hover:text-gray-700 disabled:opacity-60"
      tabBaseClassName="group inline-flex min-w-0 items-center gap-1 h-7 px-1.5 rounded-lg text-xs border max-w-[220px] shrink-0 transition-colors"
      activeTabClassName="bg-amber-50/80 border-amber-200 text-amber-900 shadow-[0_1px_2px_rgba(30,20,10,0.04)]"
      inactiveTabClassName="bg-[#f9f8f5] border-[#eee3d1] text-[#78644d] hover:bg-[#fff7ea] hover:text-[#2f2212]"
      labelClassName="px-1 text-xs font-normal"
      onPointerDown={!isDocked && !isFullscreen ? onDragStart : undefined}
      onScrollPointerDown={(event) => event.stopPropagation()}
    />
  );
}
