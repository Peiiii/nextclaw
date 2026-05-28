import type { ReactNode, Ref } from 'react';
import {
  ExternalLink,
  Search,
} from 'lucide-react';
import {
  isDocsUrl,
  type DocBrowserTab,
} from './doc-browser-context';
import { t } from '@/shared/lib/i18n';

type DocBrowserDocsToolbarProps = {
  isDocsTab: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onUrlInputChange: (value: string) => void;
  urlInput: string;
};

type DocBrowserFrameContentProps = {
  activeTabId: string;
  currentTab?: DocBrowserTab;
  currentUrl: string;
  customContent: ReactNode;
  iframeRef: Ref<HTMLIFrameElement>;
  iframeReloadVersion: number;
  iframeSandbox: string;
  isDragging: boolean;
  isResizing: boolean;
  navVersion: number;
};

export function DocBrowserDocsToolbar({
  isDocsTab,
  onSubmit,
  onUrlInputChange,
  urlInput,
}: DocBrowserDocsToolbarProps) {
  if (!isDocsTab) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3.5 py-2 bg-white border-b border-gray-100 shrink-0">
      <form onSubmit={onSubmit} className="flex-1 relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={urlInput}
          onChange={(e) => onUrlInputChange(e.target.value)}
          placeholder={t('docBrowserSearchPlaceholder')}
          className="w-full h-8 pl-8 pr-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-colors placeholder:text-gray-400"
        />
      </form>
    </div>
  );
}

export function DocBrowserFrameContent({
  activeTabId,
  currentTab,
  currentUrl,
  customContent,
  iframeRef,
  iframeReloadVersion,
  iframeSandbox,
  isDragging,
  isResizing,
  navVersion,
}: DocBrowserFrameContentProps) {
  return (
    <div className="flex-1 relative overflow-hidden">
      {customContent ? (
        customContent
      ) : (
        <iframe
          ref={iframeRef}
          key={`${activeTabId}:${navVersion}:${iframeReloadVersion}`}
          src={currentUrl}
          className="absolute inset-0 w-full h-full border-0"
          title={currentTab?.title || 'NextClaw Docs'}
          sandbox={iframeSandbox}
          allow="clipboard-read; clipboard-write"
        />
      )}
      {(isResizing || isDragging) && (
        <div className="absolute inset-0 z-10" />
      )}
    </div>
  );
}

export function DocBrowserExternalLink({ currentUrl, isDocsTab }: { currentUrl: string; isDocsTab: boolean }) {
  if (!isDocsTab || !isDocsUrl(currentUrl)) {
    return null;
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200 shrink-0">
      <a
        href={currentUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-doc-external
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary-hover font-medium transition-colors"
      >
        {t('docBrowserOpenExternal')}
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}
