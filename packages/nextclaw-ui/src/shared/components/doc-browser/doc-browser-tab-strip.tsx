import type { PointerEvent } from 'react';
import { Maximize2, PanelRightOpen, Plus, X } from 'lucide-react';
import type { DocBrowserTab } from './doc-browser-context';
import { cn } from '@/shared/lib/utils';
import { t } from '@/shared/lib/i18n';

type DocBrowserTabStripProps = {
  tabs: DocBrowserTab[];
  activeTabId: string;
  isDocked: boolean;
  isFullscreen: boolean;
  onOpenDocs: () => void;
  onSetActiveTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onClose: () => void;
  onDragStart: (event: PointerEvent<HTMLElement>) => void;
  onToggleMode: () => void;
};

export function DocBrowserTabStrip({
  tabs,
  activeTabId,
  isDocked,
  isFullscreen,
  onOpenDocs,
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
        <button
          type="button"
          onClick={onOpenDocs}
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-[#eee3d1] bg-white text-[#78644d] hover:bg-[#fff7ea] hover:text-[#2f2212] shrink-0"
          title={t('docBrowserNewTab')}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div
        className="flex h-full items-center gap-1 shrink-0"
        data-testid="doc-browser-tab-actions"
        onPointerDown={(event) => event.stopPropagation()}
      >
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
