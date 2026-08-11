import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { ChatFileOpenActionViewModel } from '@nextclaw/agent-chat-ui';
import { ChevronRight, Folder, FolderTree } from 'lucide-react';
import { Popover, PopoverTrigger } from '@/shared/components/ui/popover';
import { FileTypeIcon } from '@/shared/components/file-type-icon';
import { ChatPopoverContent } from '@/features/chat/components/chat-popover-content';
import { WorkspaceBreadcrumbBrowser } from './chat-session-workspace-file-breadcrumb-browser';
import type {
  WorkspaceFileBreadcrumbSegmentViewModel,
  WorkspaceFileBreadcrumbViewModel,
} from '@/shared/lib/session-project';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

function WorkspaceBreadcrumbWarningChip({ value }: { value: string }) {
  return (
    <span className="inline-flex h-5 items-center rounded-sm border border-amber-200 bg-amber-50 px-1.5 text-[10px] font-medium leading-none text-amber-700">
      {value}
    </span>
  );
}

function WorkspaceBreadcrumbSegmentButton({
  onFileOpen,
  segment,
}: {
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
  segment: WorkspaceFileBreadcrumbSegmentViewModel;
}) {
  const [open, setOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState<string | null>(segment.browsePath);
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setBrowsePath(segment.browsePath);
    }
    setOpen(nextOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-current={segment.isCurrent ? 'page' : undefined}
          className={cn(
            'inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-sm px-1 text-[11px] leading-none transition-colors hover:bg-gray-200/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border',
            segment.kind === 'workspace'
              ? 'bg-primary/8 text-primary hover:bg-primary/12'
              : segment.isCurrent
                ? 'bg-gray-200/70 text-gray-900'
                : 'text-gray-500',
          )}
          disabled={!segment.browsePath}
        >
          {segment.kind === 'workspace' ? (
            <FolderTree className="h-3 w-3 shrink-0" />
          ) : segment.kind === 'directory' && segment.isCurrent ? (
            <Folder className="h-3 w-3 shrink-0" />
          ) : segment.isCurrent ? (
            <FileTypeIcon fileName={segment.label} size="compact" />
          ) : null}
          <span>{segment.label}</span>
        </button>
      </PopoverTrigger>
      <ChatPopoverContent data-testid="workspace-breadcrumb-popover" className="w-[22rem] rounded-md p-0" align="start">
        <WorkspaceBreadcrumbBrowser
          browsePath={browsePath}
          onBrowsePathChange={setBrowsePath}
          onClose={() => setOpen(false)}
          onFileOpen={onFileOpen}
        />
      </ChatPopoverContent>
    </Popover>
  );
}

export function ChatSessionWorkspaceFileBreadcrumbs({
  breadcrumb,
  leading,
  onFileOpen,
}: {
  breadcrumb: WorkspaceFileBreadcrumbViewModel;
  leading?: ReactNode;
  onFileOpen: (action: ChatFileOpenActionViewModel) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const current = scroll.querySelector<HTMLElement>('[aria-current="page"]');
    if (!current) return;

    const revealCurrentSegment = () => {
      const scrollRect = scroll.getBoundingClientRect();
      const currentRect = current.getBoundingClientRect();
      if (currentRect.right > scrollRect.right) {
        scroll.scrollLeft += currentRect.right - scrollRect.right;
      } else if (currentRect.left < scrollRect.left) {
        scroll.scrollLeft -= scrollRect.left - currentRect.left;
      }
    };

    revealCurrentSegment();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(revealCurrentSegment);
    observer.observe(scroll);
    observer.observe(current);
    return () => observer.disconnect();
  }, [breadcrumb.fullPath]);

  return (
    <div
      data-testid="workspace-file-breadcrumbs"
      title={breadcrumb.fullPath}
      className="flex min-w-0 items-center border-b border-gray-200/80 bg-gray-50/55"
    >
      {leading ? <div className="flex h-full shrink-0 items-center pl-1 pr-0.5">{leading}</div> : null}
      <div
        ref={scrollRef}
        data-testid="workspace-file-breadcrumb-scroll"
        className="workspace-horizontal-scrollbar flex min-w-0 flex-1 items-center gap-2.5 overflow-x-auto overflow-y-hidden px-3 py-1.5"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1 pr-1">
          {breadcrumb.segments.map((segment, index) => (
            <Fragment key={segment.key}>
              <WorkspaceBreadcrumbSegmentButton segment={segment} onFileOpen={onFileOpen} />
              {index < breadcrumb.segments.length - 1 ? (
                <ChevronRight className="h-3 w-3 shrink-0 text-gray-300" />
              ) : null}
            </Fragment>
          ))}
        </div>

        {breadcrumb.truncated ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <WorkspaceBreadcrumbWarningChip value={t('chatWorkspacePreviewTruncated')} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
