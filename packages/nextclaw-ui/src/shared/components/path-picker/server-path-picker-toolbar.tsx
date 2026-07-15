import { FolderPlus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { t } from '@/shared/lib/i18n';

type ServerPathPickerToolbarProps = {
  disabled: boolean;
  onNewFolder: () => void;
};

export function ServerPathPickerToolbar({
  disabled,
  onNewFolder,
}: ServerPathPickerToolbarProps) {
  return (
    <div className="flex items-center border-b border-border bg-background px-3 py-1.5">
      <Button type="button" variant="ghost" size="sm" onClick={onNewFolder} disabled={disabled}>
        <FolderPlus className="mr-1 h-4 w-4" />
        {t('pathPickerNewFolder')}
      </Button>
      <span className="ml-auto text-xs text-muted-foreground">
        {t('pathPickerDoubleClickHint')}
      </span>
    </div>
  );
}
