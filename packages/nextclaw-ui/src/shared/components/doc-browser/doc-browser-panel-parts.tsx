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
  currentTab?: DocBrowserTab;
  currentUrl: string;
  customContent: ReactNode;
  iframeRef: Ref<HTMLIFrameElement>;
  iframeInstanceId: string;
  iframeSandbox: string;
  isDragging: boolean;
  isResizing: boolean;
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
    <div className="flex items-center gap-2 border-b border-border/70 bg-card px-3.5 py-2 shrink-0">
      <form onSubmit={onSubmit} className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
        <input
          type="text"
          value={urlInput}
          onChange={(e) => onUrlInputChange(e.target.value)}
          placeholder={t('docBrowserSearchPlaceholder')}
          className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs text-foreground transition-colors placeholder:text-muted-foreground/55 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </form>
    </div>
  );
}

export function DocBrowserFrameContent({
  currentTab,
  currentUrl,
  customContent,
  iframeRef,
  iframeInstanceId,
  iframeSandbox,
  isDragging,
  isResizing,
}: DocBrowserFrameContentProps) {
  return (
    <div className="flex-1 relative overflow-hidden">
      {customContent ? (
        customContent
      ) : (
        <iframe
          ref={iframeRef}
          key={iframeInstanceId}
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
    <div className="flex items-center justify-between border-t border-border/70 bg-muted/55 px-4 py-2 shrink-0">
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
