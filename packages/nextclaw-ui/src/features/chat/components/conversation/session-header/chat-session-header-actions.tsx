import { useState } from 'react';
import { GitBranch } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useChatSessionProject } from '@/features/chat/hooks/use-chat-session-project';
import { ChatSessionProjectDialog } from './chat-session-project-dialog';
import { t } from '@/shared/lib/i18n';

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
