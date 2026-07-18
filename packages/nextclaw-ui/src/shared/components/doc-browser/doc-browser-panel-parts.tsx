import type { PointerEventHandler, ReactNode, Ref } from 'react';
import {
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  isDocsUrl,
  type DocBrowserTab,
} from './doc-browser-context';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import { NavigationLink } from '@/shared/components/actions/navigation-link';
import { t } from '@/shared/lib/i18n';

type DocBrowserAddressToolbarProps = {
  isVisible: boolean;
  onRefresh: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onUrlInputChange: (value: string) => void;
  placeholder: string;
  urlInput: string;
};

type DocBrowserFrameContentProps = {
  currentTab?: DocBrowserTab;
  currentUrl: string;
  customContent: ReactNode;
  iframeRef: Ref<HTMLIFrameElement>;
  iframeInstanceId: string;
  iframeSandbox?: string;
  isDragging: boolean;
  isResizing: boolean;
  onIframePointerOver?: PointerEventHandler<HTMLIFrameElement>;
};

export function DocBrowserAddressToolbar({
  isVisible,
  onRefresh,
  onSubmit,
  onUrlInputChange,
  placeholder,
  urlInput,
}: DocBrowserAddressToolbarProps) {
  if (!isVisible) {
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
          aria-label={t('docBrowserAddressLabel')}
          placeholder={placeholder}
          className="h-8 w-full rounded-lg border border-border/75 bg-background pl-8 pr-3 text-xs text-foreground transition-colors placeholder:text-muted-foreground/55 focus:border-border focus:outline-none focus:ring-0"
        />
      </form>
      <IconActionButton
        icon={<RefreshCw className="h-3.5 w-3.5" />}
        label={t('docBrowserRefresh')}
        onClick={onRefresh}
      />
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
  onIframePointerOver,
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
          tabIndex={onIframePointerOver ? 0 : undefined}
          onPointerOver={onIframePointerOver}
          allow="clipboard-read; clipboard-write"
          allowFullScreen
        />
      )}
      {(isResizing || isDragging) && (
        <div className="absolute inset-0 z-10" />
      )}
    </div>
  );
}

function canOpenExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function DocBrowserExternalLink({ currentUrl, isVisible }: { currentUrl: string; isVisible: boolean }) {
  if (!isVisible || !canOpenExternalUrl(currentUrl)) {
    return null;
  }
  const label = isDocsUrl(currentUrl) ? t('docBrowserOpenExternal') : t('docBrowserOpenInBrowser');

  return (
    <div className="flex items-center justify-between border-t border-border/70 bg-muted/55 px-4 py-2 shrink-0">
      <NavigationLink
        href={currentUrl}
        external
        iconPosition="trailing"
        size="xs"
        data-doc-external
      >
        {label}
      </NavigationLink>
    </div>
  );
}
