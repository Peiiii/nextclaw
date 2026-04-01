import { useState } from 'react';
import { FolderOpen, FolderX, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useChatSessionProject } from '@/components/chat/hooks/use-chat-session-project';
import { ChatSessionProjectDialog } from '@/components/chat/session-header/chat-session-project-dialog';
import { t } from '@/lib/i18n';

type ChatSessionHeaderActionsProps = {
  sessionKey: string;
  canDeleteSession: boolean;
  isDeletePending: boolean;
  projectRoot?: string | null;
  onDeleteSession: () => void;
  onPromoteDraftSession?: (sessionKey: string) => void;
};

const menuItemClassName =
  'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50';

export function ChatSessionHeaderActions({
  sessionKey,
  canDeleteSession,
  isDeletePending,
  projectRoot,
  onDeleteSession,
  onPromoteDraftSession,
}: ChatSessionHeaderActionsProps) {
  const updateSessionProject = useChatSessionProject();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProjectPending, setIsProjectPending] = useState(false);
  const isBusy = isDeletePending || isProjectPending;

  const runProjectUpdate = async (nextProjectRoot: string | null) => {
    setIsProjectPending(true);
    try {
      await updateSessionProject({
        sessionKey,
        projectRoot: nextProjectRoot,
      });
      if (!canDeleteSession) {
        onPromoteDraftSession?.(sessionKey);
      }
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
            <button
              type="button"
              className={menuItemClassName}
              onClick={() => {
                setIsMenuOpen(false);
                setIsDialogOpen(true);
              }}
              disabled={isBusy}
            >
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span>{t('chatSessionSetProject')}</span>
            </button>
            {projectRoot ? (
              <button
                type="button"
                className={menuItemClassName}
                onClick={() => {
                  void runProjectUpdate(null);
                }}
                disabled={isBusy}
              >
                <FolderX className="h-4 w-4 shrink-0" />
                <span>{t('chatSessionClearProject')}</span>
              </button>
            ) : null}
            <button
              type="button"
              className={menuItemClassName}
              onClick={() => {
                setIsMenuOpen(false);
                onDeleteSession();
              }}
              disabled={!canDeleteSession || isBusy}
            >
              <Trash2 className="h-4 w-4 shrink-0 text-destructive" />
              <span>{t('chatDeleteSession')}</span>
            </button>
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
