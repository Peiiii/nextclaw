import { useState } from 'react';
import { Braces, FolderOpen, PanelRightClose, PanelRightOpen, Trash2 } from 'lucide-react';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import { useChatSessionProject } from '@/features/chat/features/session/hooks/use-chat-session-project';
import { ChatSessionHeaderMenuItem } from './chat-session-header-menu-item';
import { ChatSessionMoreActionsMenu } from './chat-session-more-actions-menu';
import { ChatSessionMetadataDialog } from './chat-session-metadata-dialog';
import { ChatSessionProjectDialog } from './chat-session-project-dialog';
import { t } from '@/shared/lib/i18n';

const SESSION_HEADER_ACTION_GROUP_CLASS = 'flex shrink-0 items-center gap-1.5';

type ChatSessionHeaderActionsProps = {
  sessionKey: string | null;
  canDeleteSession: boolean;
  isDeletePending: boolean;
  currentPath?: string | null;
  defaultWorkspacePath?: string | null;
  metadata?: Record<string, unknown> | null;
  isWorkspaceOpen: boolean;
  onToggleWorkspace: () => void;
  onDeleteSession: () => void;
};

export function ChatSessionHeaderActions({
  sessionKey,
  canDeleteSession,
  isDeletePending,
  currentPath,
  defaultWorkspacePath,
  metadata,
  isWorkspaceOpen,
  onToggleWorkspace,
  onDeleteSession,
}: ChatSessionHeaderActionsProps) {
  const updateSessionProject = useChatSessionProject();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMetadataDialogOpen, setIsMetadataDialogOpen] = useState(false);
  const [isProjectPending, setIsProjectPending] = useState(false);
  const isBusy = isDeletePending || isProjectPending;

  const runProjectUpdate = async (nextProjectRoot: string | null) => {
    if (!sessionKey) {
      return;
    }
    const persistToServer = canDeleteSession;
    setIsProjectPending(true);
    try {
      await updateSessionProject({
        sessionKey,
        projectRoot: nextProjectRoot,
        persistToServer,
      });
      setIsDialogOpen(false);
    } finally {
      setIsProjectPending(false);
    }
  };

  return (
    <div className={SESSION_HEADER_ACTION_GROUP_CLASS}>
      {sessionKey ? (
        <ChatSessionMoreActionsMenu
          sessionKey={sessionKey}
          disabled={isBusy}
        >
          <ChatSessionHeaderMenuItem
            icon={FolderOpen}
            label={t('chatSessionSetProject')}
            onClick={() => setIsDialogOpen(true)}
            disabled={isBusy}
          />
          <ChatSessionHeaderMenuItem
            icon={Braces}
            label={t('chatSessionViewMetadata')}
            onClick={() => setIsMetadataDialogOpen(true)}
            disabled={isBusy}
          />
          <ChatSessionHeaderMenuItem
            icon={Trash2}
            label={t('chatDeleteSession')}
            onClick={onDeleteSession}
            disabled={!canDeleteSession || isBusy}
            destructive
          />
        </ChatSessionMoreActionsMenu>
      ) : null}
      <IconActionButton
        icon={
          isWorkspaceOpen ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRightOpen className="h-4 w-4" />
          )
        }
        label={t(
          isWorkspaceOpen
            ? 'chatSessionCloseWorkspace'
            : 'chatSessionOpenWorkspace',
        )}
        aria-pressed={isWorkspaceOpen}
        onClick={onToggleWorkspace}
        disabled={isBusy}
      />

      {sessionKey ? (
        <>
          <ChatSessionProjectDialog
            open={isDialogOpen}
            currentProjectRoot={currentPath}
            defaultWorkspacePath={defaultWorkspacePath}
            isSaving={isProjectPending}
            onOpenChange={setIsDialogOpen}
            onSave={runProjectUpdate}
          />
          <ChatSessionMetadataDialog
            open={isMetadataDialogOpen}
            metadata={metadata}
            onOpenChange={setIsMetadataDialogOpen}
          />
        </>
      ) : null}
    </div>
  );
}
