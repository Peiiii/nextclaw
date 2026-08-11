import { useLayoutEffect, useRef, type FormEvent } from 'react';
import { Check, File, Folder, X } from 'lucide-react';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';
import { Input } from '@/shared/components/ui/input';
import { t } from '@/shared/lib/i18n';

function isValidFolderName(value: string): boolean {
  const name = value.trim();
  return Boolean(name && name !== '.' && name !== '..' && !name.includes('/') && !name.includes('\\'));
}

export function WorkspaceNewFolderTreeItem({
  error,
  kind,
  isCreating,
  level,
  name,
  onCancel,
  onNameChange,
  onSubmit,
}: {
  error: string | null;
  kind: 'directory' | 'file';
  isCreating: boolean;
  level: number;
  name: string;
  onCancel: () => void;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
}) {
  const rowRef = useRef<HTMLFormElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const valid = isValidFolderName(name);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (typeof row?.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' });
    }
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid && !isCreating) {
      onSubmit();
    }
  };

  return (
    <form
      ref={rowRef}
      role="treeitem"
      aria-label={t(kind === 'file' ? 'chatWorkspaceNewFile' : 'chatWorkspaceNewFolder')}
      className="bg-primary/5"
      onSubmit={submit}
    >
      <div
        className="flex min-h-8 min-w-0 items-center gap-1 py-0.5 pr-1"
        style={{ paddingLeft: `${8 + level * 14}px` }}
      >
        <span className="inline-flex h-4 w-4 shrink-0" />
        {kind === 'file' ? (
          <File className="h-4 w-4 shrink-0 text-gray-500" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-amber-500" />
        )}
        <Input
          ref={inputRef}
          aria-label={t(kind === 'file' ? 'chatWorkspaceFileName' : 'chatWorkspaceFolderName')}
          className="h-7 min-w-0 flex-1 rounded-md px-2 text-xs"
          disabled={isCreating}
          placeholder={t(kind === 'file' ? 'chatWorkspaceFileNamePlaceholder' : 'chatWorkspaceFolderNamePlaceholder')}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
        />
        <IconActionButton
          disabled={!valid || isCreating}
          icon={<Check className="h-3.5 w-3.5" />}
          label={t('chatWorkspaceCreateFolder')}
          size="sm"
          tooltipSide="top"
          onClick={onSubmit}
        />
        <IconActionButton
          disabled={isCreating}
          icon={<X className="h-3.5 w-3.5" />}
          label={t('cancel')}
          size="sm"
          tooltipSide="top"
          onClick={onCancel}
        />
      </div>
      {error ? (
        <p
          role="alert"
          className="pb-1 pr-2 text-[11px] text-destructive"
          style={{ paddingLeft: `${42 + level * 14}px` }}
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
