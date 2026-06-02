import type { PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, Maximize2, PanelRightOpen, Pin, PinOff, Plus, X } from 'lucide-react';
import type { DocBrowserDockState, DocBrowserTab } from './doc-browser-context';
import { cn } from '@/shared/lib/utils';
import { t } from '@/shared/lib/i18n';

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
  return (
    <div
      data-testid="doc-browser-tab-strip"
      className={cn(
        'flex h-11 items-stretch gap-2 px-2.5 bg-background border-b border-[#f1e7d4] shrink-0 select-none',
        isFullscreen && 'h-[calc(env(safe-area-inset-top,0px)+2.75rem)] pt-[env(safe-area-inset-top,0px)]',
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
                'inline-flex items-center gap-1 h-7 px-1.5 rounded-lg text-xs border max-w-[220px] shrink-0 transition-colors',
                isActive
                  ? 'bg-amber-50/80 border-amber-200 text-amber-900 shadow-[0_1px_2px_rgba(30,20,10,0.04)]'
                  : 'bg-[#f9f8f5] border-[#eee3d1] text-[#78644d] hover:bg-[#fff7ea] hover:text-[#2f2212]',
              )}
            >
              <button
                type="button"
                onClick={() => onSetActiveTab(tab.id)}
                className="truncate text-left px-1"
                title={tab.title}
              >
                {tab.title || t('docBrowserTabUntitled')}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className="rounded p-0.5 hover:bg-black/10"
                aria-label={t('docBrowserCloseTab')}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
      <div
        className="flex h-full items-center gap-1 shrink-0"
        data-testid="doc-browser-tab-actions"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onGoBack}
          disabled={!canGoBack}
          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:text-gray-300 disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-gray-300"
          title={t('docBrowserBack')}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onGoForward}
          disabled={!canGoForward}
          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:text-gray-300 disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-gray-300"
          title={t('docBrowserForward')}
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onOpenNewTab}
          className="hover:bg-gray-100 rounded-md p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
          title={t('docBrowserNewTab')}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        {dockState?.canDock ? (
          <button
            type="button"
            onClick={onToggleDock}
            disabled={dockState.isDocked && !dockState.removable}
            className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:text-gray-300 disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-gray-300"
            title={
              dockState.isDocked
                ? dockState.removable ? t('sideDockUnpinCurrent') : t('sideDockBuiltInDocked')
                : t('sideDockPinCurrent')
            }
          >
            {dockState.isDocked && dockState.removable ? (
              <PinOff className="w-3.5 h-3.5" />
            ) : (
              <Pin className="w-3.5 h-3.5" />
            )}
          </button>
        ) : null}
        {!isFullscreen ? (
          <button
            type="button"
            onClick={onToggleMode}
            className="hover:bg-gray-100 rounded-md p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
            title={isDocked ? t('docBrowserFloatMode') : t('docBrowserDockMode')}
          >
            {isDocked ? <Maximize2 className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="hover:bg-gray-100 rounded-md p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
          title={t('docBrowserClose')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
