import { Plus, X } from 'lucide-react';
import type { DocBrowserTab } from './doc-browser-context';
import { cn } from '@/shared/lib/utils';
import { t } from '@/shared/lib/i18n';

type DocBrowserTabStripProps = {
  tabs: DocBrowserTab[];
  activeTabId: string;
  onOpenDocs: () => void;
  onSetActiveTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
};

export function DocBrowserTabStrip({
  tabs,
  activeTabId,
  onOpenDocs,
  onSetActiveTab,
  onCloseTab,
}: DocBrowserTabStripProps) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-2 bg-background border-b border-[#f1e7d4] overflow-x-auto custom-scrollbar">
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
  );
}
