import { useState } from 'react';
import { ChevronDown, FolderOpen, FolderX, Pencil } from 'lucide-react';
import { useChatSessionProject } from '@/features/chat/features/session/hooks/use-chat-session-project';
import { ChatSessionHeaderMenuItem } from './chat-session-header-menu-item';
import { ChatSessionProjectDialog } from './chat-session-project-dialog';
import {
  Popover,
  PopoverTrigger,
  createPopoverAvailableHeightLimit,
} from '@/shared/components/ui/popover';
import { ChatPopoverContent } from '@/features/chat/components/chat-popover-content';
import { t } from '@/shared/lib/i18n';

type ChatSessionProjectBadgeProps = {
  sessionKey: string;
  projectName: string;
  projectRoot?: string | null;
  persistToServer: boolean;
};

const SESSION_PROJECT_MENU_STYLE = {
  maxHeight: createPopoverAvailableHeightLimit('18rem'),
};

export function ChatSessionProjectBadge({
  sessionKey,
  projectName,
  projectRoot,
  persistToServer,
}: ChatSessionProjectBadgeProps) {
  const updateSessionProject = useChatSessionProject();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProjectPending, setIsProjectPending] = useState(false);

  const runProjectUpdate = async (nextProjectRoot: string | null) => {
    setIsProjectPending(true);
    try {
      await updateSessionProject({
        sessionKey,
        projectRoot: nextProjectRoot,
        persistToServer,
      });
      setIsDialogOpen(false);
      setIsMenuOpen(false);
    } finally {
      setIsProjectPending(false);
    }
  };

  return (
    <>
      <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={projectRoot ?? undefined}
            className="min-w-0 max-w-[320px] shrink rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/35 hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={t('chatSessionSetProject')}
            disabled={isProjectPending}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{projectName}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
            </span>
          </button>
        </PopoverTrigger>
        <ChatPopoverContent
          align="start"
          className="w-72 p-2"
          style={SESSION_PROJECT_MENU_STYLE}
        >
          <div className="px-3 pb-2 pt-1">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {projectName}
            </div>
            {projectRoot ? (
              <div className="mt-1 break-all text-xs text-muted-foreground">
                {projectRoot}
              </div>
            ) : null}
          </div>
          <div className="space-y-1">
            <ChatSessionHeaderMenuItem
              icon={Pencil}
              label={t('chatSessionSetProject')}
              onClick={() => {
                setIsMenuOpen(false);
                setIsDialogOpen(true);
              }}
              disabled={isProjectPending}
            />
            <ChatSessionHeaderMenuItem
              icon={FolderX}
              label={t('chatSessionClearProject')}
              onClick={() => {
                void runProjectUpdate(null);
              }}
              disabled={isProjectPending}
            />
          </div>
        </ChatPopoverContent>
      </Popover>

      <ChatSessionProjectDialog
        open={isDialogOpen}
        currentProjectRoot={projectRoot}
        isSaving={isProjectPending}
        onOpenChange={setIsDialogOpen}
        onSave={runProjectUpdate}
      />
    </>
  );
}
