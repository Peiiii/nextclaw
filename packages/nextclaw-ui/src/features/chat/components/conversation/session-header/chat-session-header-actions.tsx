import { useState } from 'react';
import { AlarmClock, FolderOpen, GitBranch, MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { useChatSessionProject } from '@/features/chat/hooks/use-chat-session-project';
import { ChatSessionHeaderMenuItem } from './chat-session-header-menu-item';
import { ChatSessionProjectDialog } from './chat-session-project-dialog';
import { t } from '@/shared/lib/i18n';

const SESSION_HEADER_ACTION_GROUP_CLASS = 'flex shrink-0 items-center gap-1.5';
const SESSION_HEADER_ACTION_BUTTON_CLASS = 'h-7 w-7 rounded-lg shrink-0 text-gray-400 hover:text-gray-700';

type ChatSessionHeaderActionsProps = {
  sessionKey: string;
  canDeleteSession: boolean;
  isDeletePending: boolean;
  projectRoot?: string | null;
  childSessionCount?: number;
  sessionCronJobCount?: number;
  onOpenChildSessions?: () => void;
  onOpenSessionCronJobs?: () => void;
  onDeleteSession: () => void;
};

export function ChatSessionHeaderActions({
  sessionKey,
  canDeleteSession,
  isDeletePending,
  projectRoot,
  childSessionCount = 0,
  sessionCronJobCount = 0,
  onOpenChildSessions,
  onOpenSessionCronJobs,
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
    <div className={SESSION_HEADER_ACTION_GROUP_CLASS}>
      {childSessionCount > 0 && onOpenChildSessions ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={SESSION_HEADER_ACTION_BUTTON_CLASS}
          aria-label={t('chatSessionOpenChildSessions')}
          title={t('chatSessionOpenChildSessions')}
          onClick={onOpenChildSessions}
          disabled={isBusy}
        >
          <GitBranch className="h-4 w-4" />
        </Button>
      ) : null}
      {sessionCronJobCount > 0 && onOpenSessionCronJobs ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={SESSION_HEADER_ACTION_BUTTON_CLASS}
          aria-label={t('chatSessionOpenCronJobs')}
          title={t('chatSessionOpenCronJobs')}
          onClick={onOpenSessionCronJobs}
          disabled={isBusy}
        >
          <AlarmClock className="h-4 w-4" />
        </Button>
      ) : null}
      <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={SESSION_HEADER_ACTION_BUTTON_CLASS}
            aria-label={t('chatSessionMoreActions')}
            disabled={isBusy}
          >
            <MoreVertical className="h-4 w-4" />
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
    </div>
  );
}
