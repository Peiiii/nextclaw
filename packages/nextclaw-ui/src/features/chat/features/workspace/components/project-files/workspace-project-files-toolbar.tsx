import { ChevronsUp, FilePlus2, FolderPlus, MoreHorizontal, RefreshCw } from 'lucide-react';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
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
    <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-gray-200/80 bg-gray-50/55 px-1.5">
      <span
        className="min-w-0 flex-1 truncate px-0.5 text-[11px] font-semibold uppercase tracking-[0.03em] text-gray-800"
        title={rootLabel}
      >
        {rootLabel}
      </span>
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
          icon={<MoreHorizontal className="h-4 w-4" />}
          label={t('chatWorkspaceRootMoreActions')}
          size="sm"
        />
      </ContextMenuTrigger>
    </div>
  );
}
