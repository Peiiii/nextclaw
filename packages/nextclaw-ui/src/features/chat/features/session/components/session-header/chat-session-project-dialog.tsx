import { ServerPathPickerDialog } from '@/shared/components/path-picker/server-path-picker-dialog';
import { t } from '@/shared/lib/i18n';

type ChatSessionProjectDialogProps = {
  open: boolean;
  currentProjectRoot?: string | null;
  defaultWorkspacePath?: string | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (projectRoot: string) => Promise<void> | void;
};

export function ChatSessionProjectDialog({
  open,
  currentProjectRoot,
  defaultWorkspacePath,
  isSaving,
  onOpenChange,
  onSave,
}: ChatSessionProjectDialogProps) {
  return (
    <ServerPathPickerDialog
      open={open}
      currentPath={currentProjectRoot}
      defaultWorkspacePath={defaultWorkspacePath}
      isSaving={isSaving}
      onOpenChange={onOpenChange}
      onConfirm={onSave}
      title={t('chatSessionProjectDialogTitle')}
      description={t('chatSessionProjectDialogDescription')}
      pathLabel={t('chatSessionProjectPathLabel')}
      pathPlaceholder={t('chatSessionProjectPathPlaceholder')}
      confirmLabel={t('chatSessionSetProject')}
      hint={t('chatSessionProjectUpdateHint')}
    />
  );
}
