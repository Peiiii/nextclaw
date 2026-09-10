import { PageResourceIcon } from '@/features/right-panel-resources';
import {
  ArrowLeft,
  ArrowRight,
  Pin,
  PinOff,
  Plus,
} from "lucide-react";
import type { DocBrowserDockState, DocBrowserTab } from "./doc-browser-context";
import type { ContextMenuGroup } from "@/shared/components/ui/context-menu/context-menu";
import {
  CompactTabStrip,
  type CompactTabStripAction,
  type CompactTabStripTab,
} from "@/shared/components/ui/tab-strip/compact-tab-strip";
import { t } from "@/shared/lib/i18n";

type DocBrowserTabStripProps = {
  tabs: DocBrowserTab[];
  activeTabId: string;
  canGoBack: boolean;
  canGoForward: boolean;
  dockState?: DocBrowserDockState;
  onGoBack: () => void;
  onGoForward: () => void;
  onOpenNewTab: () => void;
  onToggleDock?: () => void;
  onSetActiveTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  getTabMenuGroups?: (tab: DocBrowserTab) => readonly ContextMenuGroup[] | undefined;
};

function DocBrowserTabIcon({ tab }: { tab: DocBrowserTab }) {
  return <PageResourceIcon uri={tab.resourceUri ?? tab.currentUrl} icon={tab.dockIcon} />;
}

export function DocBrowserTabStrip({
  tabs,
  activeTabId,
  canGoBack,
  canGoForward,
  dockState,
  onGoBack,
  onGoForward,
  onOpenNewTab,
  onToggleDock,
  onSetActiveTab,
  onCloseTab,
  getTabMenuGroups,
}: DocBrowserTabStripProps) {
  const backLabel = t("docBrowserBack");
  const closeTabLabel = t("workbenchCloseTab");
  const dockLabel = dockState?.isDocked
    ? dockState.removable
      ? t("sideDockUnpinCurrent")
      : t("sideDockBuiltInDocked")
    : t("sideDockPinCurrent");
  const forwardLabel = t("docBrowserForward");
  const newTabLabel = t("docBrowserNewTab");
  const compactTabs: CompactTabStripTab[] = tabs.map((tab) => ({
    key: tab.id,
    label: tab.title || t("docBrowserTabUntitled"),
    active: tab.id === activeTabId,
    tooltip: tab.title,
    leadingIcon: <DocBrowserTabIcon tab={tab} />,
    closeLabel: closeTabLabel,
    closePlacement: "leading-hover",
    onSelect: () => onSetActiveTab(tab.id),
    onClose: () => onCloseTab(tab.id),
    menuLabel: t("docBrowserTabMoreActions"),
    menuGroups: getTabMenuGroups?.(tab),
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
  ];

  return (
    <CompactTabStrip
      testId="doc-browser-tab-strip"
      actionsTestId="doc-browser-tab-actions"
      tabs={compactTabs}
      actions={actions}
      className="h-10 min-w-0 flex-1 gap-1 border-0 bg-transparent px-0 select-none"
      scrollClassName="doc-browser-tab-scrollbar flex h-full items-center gap-0.5"
      tabsClassName="items-center gap-0.5"
      actionsClassName="h-full items-center gap-0.5"
      actionButtonClassName="rounded-md p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
      tabBaseClassName="inline-flex cursor-pointer items-center gap-0.5 h-7 px-2 rounded-md text-xs max-w-[220px] shrink-0 transition-colors"
      activeTabClassName="bg-muted/80 text-foreground"
      inactiveTabClassName="text-muted-foreground hover:bg-muted/45 hover:text-foreground"
      labelClassName="px-0.5 text-xs font-normal"

    />
  );
}
