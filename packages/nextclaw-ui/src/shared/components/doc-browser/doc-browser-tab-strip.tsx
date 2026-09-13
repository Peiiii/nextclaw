import { PageResourceIcon } from '@/features/right-panel-resources';
import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { ContextMenuItems } from '@/shared/components/ui/context-menu/context-menu';
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
  compact?: boolean;
  mobileToolbar?: ReactNode;
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
  mobileToolbar,
  compact = false,
}: DocBrowserTabStripProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const current = tabs.find(tab => tab.id === activeTabId);
  const mobileGroups: ContextMenuGroup[] = [
    { key: 'tabs', items: compactTabs.map(tab => ({ key: tab.key, label: tab.label, icon: tab.leadingIcon, pressed: tab.active, onSelect: tab.onSelect })) },
    { key: 'navigation', items: actions.map(action => ({ key: action.key, label: action.label, icon: action.icon, disabled: action.disabled, onSelect: action.onClick })) },
    ...(current ? getTabMenuGroups?.(current) ?? [] : []),
    ...(current ? [{ key: 'close-tab', items: [{ key: 'close-tab', label: closeTabLabel, onSelect: () => onCloseTab(current.id) }] }] : []),
  ];
  if (compact) return (
    <div className="flex h-12 min-w-0 flex-1 items-center">
      <Popover open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="flex h-8 min-w-0 items-center gap-2 rounded-lg px-2 text-sm font-medium hover:bg-[var(--interaction-hover)]" aria-label={t('docBrowserTabMoreActions')}>
            {current ? <DocBrowserTabIcon tab={current} /> : null}
            <span className="truncate">{current?.title || t('docBrowserTabUntitled')}</span><ChevronDown className="h-4 w-4 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="max-h-[70dvh] w-72 overflow-y-auto p-1">
          <ContextMenuItems groups={mobileGroups} onClose={() => setMobileMenuOpen(false)} />
          {mobileToolbar}
        </PopoverContent>
      </Popover>
    </div>
  );
  return (
    <CompactTabStrip
      testId="doc-browser-tab-strip"
      actionsTestId="doc-browser-tab-actions"
      tabs={compactTabs}
      actions={actions}
      className="flex h-10 min-w-0 flex-1 gap-1 border-0 bg-transparent px-0 select-none"
      scrollClassName="doc-browser-tab-scrollbar flex h-full max-md:h-11 max-md:basis-full items-center gap-0.5"
      tabsClassName="items-center gap-0.5"
      actionsClassName="h-full max-md:h-11 max-md:w-full items-center gap-0.5"
      tabBaseClassName="inline-flex cursor-pointer items-center gap-0.5 h-7 max-md:min-h-11 px-2 rounded-md text-xs max-w-[220px] shrink-0 transition-colors"
      activeTabClassName="bg-[var(--interaction-selection)] text-foreground"
      inactiveTabClassName="text-muted-foreground hover:bg-[var(--interaction-hover)] hover:text-foreground"
      labelClassName="px-0.5 text-xs font-normal"

    />
  );
}
