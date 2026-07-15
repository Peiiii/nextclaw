import type { KeyboardEvent } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { t } from '@/shared/lib/i18n';

type ServerPathPickerNewFolderProps = {
  errorMessage: string | null;
  isCreating: boolean;
  name: string;
  onCancel: () => void;
  onCreate: () => void;
  onNameChange: (name: string) => void;
};

export function ServerPathPickerNewFolder({
  errorMessage,
  isCreating,
  name,
  onCancel,
  onCreate,
  onNameChange,
}: ServerPathPickerNewFolderProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onCreate();
    }
    if (event.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="border-b border-gray-200 bg-white px-3 py-2">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('pathPickerNewFolderPlaceholder')}
          aria-label={t('pathPickerNewFolderName')}
          autoFocus
          disabled={isCreating}
        />
        <Button type="button" onClick={onCreate} disabled={!name.trim() || isCreating}>
          {isCreating ? t('saving') : t('pathPickerCreateFolder')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isCreating}>
          {t('cancel')}
        </Button>
      </div>
      {errorMessage ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {t('pathPickerCreateFolderFailed')}: {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
