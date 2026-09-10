import { useState } from 'react';
import { ChevronDown, Clock3, Folder, FolderPlus, Plus, Search, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import { Input } from '@/shared/components/ui/input';
import { Popover, PopoverTrigger } from '@/shared/components/ui/popover';
import { ChatPopoverContent } from '@/features/chat/components/chat-popover-content';
import { ChatSessionHeaderMenuItem } from '@/features/chat/features/session/components/session-header/chat-session-header-menu-item';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';
import { SIDEBAR_RAIL_CONTROL_CLASS, SIDEBAR_RAIL_ICON_CLASS, SIDEBAR_RAIL_SURFACE_CLASS } from '@/app/components/layout/sidebar-rail.styles';

type ChatSidebarToolbarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  onCreateSession: () => void;
  collapsed?: boolean;
};

export function ChatSidebarDesktopToolbar({ query, onQueryChange, onCreateSession, collapsed }: ChatSidebarToolbarProps) {
  if (collapsed) {
    return <div className="px-2 pb-2">
      <IconActionButton icon={<Plus className={SIDEBAR_RAIL_ICON_CLASS} />} label={t('chatSidebarNewTask')}
        className={cn(SIDEBAR_RAIL_CONTROL_CLASS, SIDEBAR_RAIL_SURFACE_CLASS)} onClick={onCreateSession} />
    </div>;
  }
  return <>
    <div className="px-4 pb-2">
      <Button variant="ghost" className="w-full rounded-lg bg-primary/10 text-primary hover:bg-primary/15" onClick={onCreateSession}>
        <Plus className="mr-1.5 h-4 w-4" />{t('chatSidebarNewTask')}
      </Button>
    </div>
    <div className="px-4 pb-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
        <Input data-theme-control="chat-search" value={query} onChange={event => onQueryChange(event.target.value)}
          placeholder={t('chatSidebarSearchPlaceholder')} className="h-8 rounded-lg border-0 bg-background/55 pl-8 text-xs shadow-none hover:bg-background/75" />
      </div>
    </div>
  </>;
}

export function ChatSidebarMobileToolbar(props: ChatSidebarToolbarProps & {
  isProjectFirstView: boolean;
  onSelectMode: (mode: 'time-first' | 'project-first') => void;
  onAddProject: () => void;
}) {
  const { query, onQueryChange, onCreateSession, isProjectFirstView, onSelectMode, onAddProject } = props;
  const [searchOpen, setSearchOpen] = useState(Boolean(query));
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  return (
    <div className="shrink-0 border-b border-border/50 bg-background px-3 text-foreground" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex h-14 items-center gap-1">
        <Popover open={viewMenuOpen} onOpenChange={setViewMenuOpen}>
          <h1>
            <PopoverTrigger asChild>
              <button type="button" aria-label={t('chatSidebarViewMode')} className="flex h-11 min-w-0 items-center gap-1.5 rounded-lg px-1 text-[18px] font-semibold text-foreground">
                {t('chat')}{isProjectFirstView ? <Folder className="h-4 w-4" /> : null}
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </PopoverTrigger>
          </h1>
          <ChatPopoverContent align="start" className="w-48 p-1.5">
            <div onClick={() => setViewMenuOpen(false)}>
              <ChatSessionHeaderMenuItem icon={Clock3} label={t('chatSidebarViewTime')} onClick={() => onSelectMode('time-first')} />
              <ChatSessionHeaderMenuItem icon={Folder} label={t('chatSidebarViewProject')} onClick={() => onSelectMode('project-first')} />
              <ChatSessionHeaderMenuItem icon={FolderPlus} label={t('chatProjectAdd')} onClick={onAddProject} />
            </div>
          </ChatPopoverContent>
        </Popover>
        <div className="flex-1" />
        <IconActionButton icon={searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          label={t(searchOpen ? 'chatSidebarCloseSearch' : 'chatSidebarSearchPlaceholder')} className="h-11 w-11" tooltip={false}
          onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) onQueryChange(''); }} />
        <IconActionButton icon={<Plus className="h-5 w-5" />} label={t('chatSidebarNewTask')} className="h-11 w-11" tooltip={false} onClick={onCreateSession} />
      </div>
      {searchOpen ? <div className="pb-2">
        <Input autoFocus value={query} onChange={event => onQueryChange(event.target.value)} placeholder={t('chatSidebarSearchPlaceholder')}
          aria-label={t('chatSidebarSearchPlaceholder')} className="h-10 rounded-lg border-0 bg-muted px-3 text-base shadow-none" />
      </div> : null}
    </div>
  );
}
