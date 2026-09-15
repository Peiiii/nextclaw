import { ChevronsUp, FilePlus2, FolderPlus, MoreVertical, RefreshCw } from 'lucide-react';
import { IconActionButton, IconActionGroup } from '@/shared/components/ui/actions/icon-action-button';
import { ContextMenuTrigger } from '@/shared/components/ui/context-menu/context-menu';
import { t } from '@/shared/lib/i18n';

export function WorkspaceProjectFilesToolbar({
  disabled,
  rootLabel,
  onCollapseAll,
  onNewFile,
  onNewFolder,
  onRefresh,
}: {
  disabled: boolean;
  rootLabel: string;
  onCollapseAll: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-border bg-background px-1.5">
      <span
        className="min-w-0 flex-1 truncate px-1 text-xs font-medium text-muted-foreground"
        title={rootLabel}
      >
        {rootLabel}
      </span>
      <IconActionGroup>
      <IconActionButton
        icon={<FilePlus2 className="h-4 w-4" />}
        label={t('chatWorkspaceNewFile')}
        size="sm"
        disabled={disabled}
        onClick={onNewFile}
      />
      <IconActionButton
        icon={<FolderPlus className="h-4 w-4" />}
        label={t('chatWorkspaceNewFolder')}
        size="sm"
        disabled={disabled}
        onClick={onNewFolder}
      />
      <IconActionButton
        icon={<RefreshCw className="h-4 w-4" />}
        label={t('chatWorkspaceRefreshExplorer')}
        size="sm"
        onClick={onRefresh}
      />
      <IconActionButton
        icon={<ChevronsUp className="h-4 w-4" />}
        label={t('chatWorkspaceCollapseAll')}
        size="sm"
        onClick={onCollapseAll}
      />
      <ContextMenuTrigger>
        <IconActionButton
          icon={<MoreVertical className="h-4 w-4" />}
          label={t('chatWorkspaceRootMoreActions')}
          size="sm"
        />
      </ContextMenuTrigger>
      </IconActionGroup>
    </div>
  );
}
