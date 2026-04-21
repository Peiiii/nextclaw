import { useState } from 'react';
import { FolderOpen, GitBranch, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useChatSessionProject } from '@/features/chat/hooks/use-chat-session-project';
import { ChatSessionHeaderMenuItem } from './chat-session-header-menu-item';
import { ChatSessionProjectDialog } from './chat-session-project-dialog';
import { t } from '@/lib/i18n';

type ChatSessionHeaderActionsProps = {
  sessionKey: string;
  canDeleteSession: boolean;
  isDeletePending: boolean;
  projectRoot?: string | null;
  childSessionCount?: number;
  onOpenChildSessions?: () => void;
  onDeleteSession: () => void;
};

export function ChatSessionHeaderActions({
  sessionKey,
  canDeleteSession,
  isDeletePending,
  projectRoot,
  childSessionCount = 0,
  onOpenChildSessions,
  onDeleteSession,
}: ChatSessionHeaderActionsProps) {
  const updateSessionProject = useChatSessionProject();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProjectPending, setIsProjectPending] = useState(false);
  const isBusy = isDeletePending || isProjectPending;

  const runProjectUpdate = async (nextProjectRoot: string | null) => {
    const persistToServer = canDeleteSession;
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
      {childSessionCount > 0 && onOpenChildSessions ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-lg shrink-0 text-gray-400 hover:text-gray-700"
          aria-label={t('chatSessionOpenChildSessions')}
          title={t('chatSessionOpenChildSessions')}
          onClick={onOpenChildSessions}
          disabled={isBusy}
        >
          <GitBranch className="h-4 w-4" />
        </Button>
      ) : null}
      <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg shrink-0 text-gray-400 hover:text-gray-700"
            aria-label={t('chatSessionMoreActions')}
            disabled={isBusy}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-2">
          <div className="space-y-1">
            <ChatSessionHeaderMenuItem
              icon={FolderOpen}
              label={t('chatSessionSetProject')}
              onClick={() => {
                setIsMenuOpen(false);
                setIsDialogOpen(true);
              }}
              disabled={isBusy}
            />
            <ChatSessionHeaderMenuItem
              icon={Trash2}
              label={t('chatDeleteSession')}
              onClick={() => {
                setIsMenuOpen(false);
                onDeleteSession();
              }}
              disabled={!canDeleteSession || isBusy}
              destructive
            />
          </div>
        </PopoverContent>
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
