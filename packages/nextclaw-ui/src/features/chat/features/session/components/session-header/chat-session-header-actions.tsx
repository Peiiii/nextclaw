import { useState } from 'react';
import { AlarmClock, Braces, FolderOpen, GitBranch, MoreVertical, Trash2 } from 'lucide-react';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import { Popover, PopoverTrigger } from '@/shared/components/ui/popover';
import { ChatPopoverContent } from '@/features/chat/components/chat-popover-content';
import { useChatSessionProject } from '@/features/chat/features/session/hooks/use-chat-session-project';
import { ChatSessionHeaderMenuItem } from './chat-session-header-menu-item';
import { ChatSessionMetadataDialog } from './chat-session-metadata-dialog';
import { ChatSessionProjectDialog } from './chat-session-project-dialog';
import { t } from '@/shared/lib/i18n';

const SESSION_HEADER_ACTION_GROUP_CLASS = 'flex shrink-0 items-center gap-1.5';

type ChatSessionHeaderActionsProps = {
  sessionKey: string;
  canDeleteSession: boolean;
  isDeletePending: boolean;
  projectRoot?: string | null;
  metadata?: Record<string, unknown> | null;
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
  metadata,
  childSessionCount = 0,
  sessionCronJobCount = 0,
  onOpenChildSessions,
  onOpenSessionCronJobs,
  onDeleteSession,
}: ChatSessionHeaderActionsProps) {
  const updateSessionProject = useChatSessionProject();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMetadataDialogOpen, setIsMetadataDialogOpen] = useState(false);
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
        <IconActionButton
          icon={<GitBranch className="h-4 w-4" />}
          label={t('chatSessionOpenChildSessions')}
          onClick={onOpenChildSessions}
          disabled={isBusy}
        />
      ) : null}
      {sessionCronJobCount > 0 && onOpenSessionCronJobs ? (
        <IconActionButton
          icon={<AlarmClock className="h-4 w-4" />}
          label={t('chatSessionOpenCronJobs')}
          onClick={onOpenSessionCronJobs}
          disabled={isBusy}
        />
      ) : null}
      <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <PopoverTrigger asChild>
          <IconActionButton
            icon={<MoreVertical className="h-4 w-4" />}
            label={t('chatSessionMoreActions')}
            tooltip={false}
            disabled={isBusy}
          />
        </PopoverTrigger>
        <ChatPopoverContent align="end" className="w-56 p-2">
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
              icon={Braces}
              label={t('chatSessionViewMetadata')}
              onClick={() => {
                setIsMenuOpen(false);
                setIsMetadataDialogOpen(true);
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
        </ChatPopoverContent>
      </Popover>

      <ChatSessionProjectDialog
        open={isDialogOpen}
        currentProjectRoot={projectRoot}
        isSaving={isProjectPending}
        onOpenChange={setIsDialogOpen}
        onSave={runProjectUpdate}
      />
      <ChatSessionMetadataDialog
        open={isMetadataDialogOpen}
        metadata={metadata}
        onOpenChange={setIsMetadataDialogOpen}
      />
    </div>
  );
}
