import { ServerPathPickerDialog } from '@/components/path-picker/server-path-picker-dialog';
import { t } from '@/lib/i18n';

type ChatSessionProjectDialogProps = {
  open: boolean;
  currentProjectRoot?: string | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (projectRoot: string) => Promise<void> | void;
};

export function ChatSessionProjectDialog({
  open,
  currentProjectRoot,
  isSaving,
  onOpenChange,
  onSave,
}: ChatSessionProjectDialogProps) {
  return (
    <ServerPathPickerDialog
      open={open}
      currentPath={currentProjectRoot}
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
