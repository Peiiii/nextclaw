import { Button } from '@/shared/components/ui/button';
import { DialogFooter } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { t } from '@/shared/lib/i18n';

type ServerPathPickerFooterProps = {
  confirmLabel: string;
  disabled: boolean;
  hint?: string;
  isSaving: boolean;
  onCancel: () => void;
  onSelectedPathChange: (path: string) => void;
  pathLabel: string;
  pathPlaceholder?: string;
  selectedPath: string;
};

export function ServerPathPickerFooter({
  confirmLabel,
  disabled,
  hint,
  isSaving,
  onCancel,
  onSelectedPathChange,
  pathLabel,
  pathPlaceholder,
  selectedPath,
}: ServerPathPickerFooterProps) {
  return (
    <div className="min-w-0 border-t border-border bg-muted/20 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Label htmlFor="server-path-picker-selection" className="shrink-0 text-sm">
          {pathLabel}
        </Label>
        <Input
          id="server-path-picker-selection"
          value={selectedPath}
          onChange={(event) => onSelectedPathChange(event.target.value)}
          placeholder={pathPlaceholder}
          disabled={isSaving}
          className="h-9 min-w-0 flex-1 bg-background"
        />
        <DialogFooter className="shrink-0 flex-row gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={disabled}>
            {isSaving ? t('saving') : confirmLabel}
          </Button>
        </DialogFooter>
      </div>
      {hint ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
