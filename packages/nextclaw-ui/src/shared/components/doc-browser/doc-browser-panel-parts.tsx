import type { ReactNode, Ref } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ExternalLink,
  Maximize2,
  PanelRightOpen,
  Search,
  X,
} from 'lucide-react';
import {
  isDocsUrl,
  type DocBrowserTab,
} from './doc-browser-context';
import type { DocBrowserCustomTabRenderer } from './doc-browser-renderer.types';
import { cn } from '@/shared/lib/utils';
import { t } from '@/shared/lib/i18n';

type DocBrowserPanelHeaderProps = {
  currentTab?: DocBrowserTab;
  customRenderer?: DocBrowserCustomTabRenderer;
  isDocked: boolean;
  isFullscreen: boolean;
  onClose: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onToggleMode: () => void;
};

type DocBrowserDocsToolbarProps = {
  currentTab?: DocBrowserTab;
  isDocsTab: boolean;
  onBack: () => void;
  onForward: () => void;
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

export function DocBrowserPanelHeader({
  currentTab,
  customRenderer,
  isDocked,
  isFullscreen,
  onClose,
  onDragStart,
  onToggleMode,
}: DocBrowserPanelHeaderProps) {
  const title = currentTab && customRenderer?.getTitle
    ? customRenderer.getTitle(currentTab)
    : t('docBrowserTitle');
  const icon = currentTab && customRenderer?.renderIcon
    ? customRenderer.renderIcon(currentTab)
    : <BookOpen className="w-4 h-4 text-primary shrink-0" />;

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200 shrink-0 select-none',
        !isDocked && !isFullscreen && 'cursor-grab active:cursor-grabbing',
        isFullscreen && 'pt-[calc(env(safe-area-inset-top,0px)+0.625rem)]',
      )}
      onMouseDown={!isDocked && !isFullscreen ? onDragStart : undefined}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon}
        <span className="text-sm font-semibold text-gray-900 truncate">{title}</span>
      </div>
      <div className="flex items-center gap-1">
        {!isFullscreen ? (
          <button
            onClick={onToggleMode}
            className="hover:bg-gray-200 rounded-md p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
            title={isDocked ? t('docBrowserFloatMode') : t('docBrowserDockMode')}
          >
            {isDocked ? <Maximize2 className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
          </button>
        ) : null}
        <button
          onClick={onClose}
          className="hover:bg-gray-200 rounded-md p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
          title={t('docBrowserClose')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function DocBrowserDocsToolbar({
  currentTab,
  isDocsTab,
  onBack,
  onForward,
  onSubmit,
  onUrlInputChange,
  urlInput,
}: DocBrowserDocsToolbarProps) {
  if (!isDocsTab) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3.5 py-2 bg-white border-b border-gray-100 shrink-0">
      <button
        onClick={onBack}
        disabled={!isDocsTab || (currentTab?.historyIndex ?? 0) <= 0}
        className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>
      <button
        onClick={onForward}
        disabled={!isDocsTab || (currentTab?.historyIndex ?? 0) >= (currentTab?.history.length ?? 0) - 1}
        className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 transition-colors"
      >
        <ArrowRight className="w-4 h-4" />
      </button>

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
