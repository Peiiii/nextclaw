import { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import type { ProjectCreateRequest, ProjectTemplateView } from '@/shared/lib/api';
import { ServerPathPickerDialog } from '@/shared/components/path-picker/server-path-picker-dialog';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { t } from '@/shared/lib/i18n';

type ProjectTemplateId = NonNullable<ProjectCreateRequest['template']>;

type ChatProjectCreateDialogProps = {
  open: boolean;
  defaultWorkspacePath?: string | null;
  templates: readonly ProjectTemplateView[];
  isCreating: boolean;
  errorMessage?: string | null;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: ProjectCreateRequest) => Promise<void>;
};

function projectTemplateLabel(templateId: ProjectTemplateId): string {
  return t(
    templateId === 'knowledge-base'
      ? 'chatProjectTemplateKnowledgeBase'
      : 'chatProjectTemplateEmpty',
  );
}

export function ChatProjectCreateDialog({
  open,
  defaultWorkspacePath,
  templates,
  isCreating,
  errorMessage,
  onOpenChange,
  onCreate,
}: ChatProjectCreateDialogProps) {
  const [name, setName] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [pathPickerOpen, setPathPickerOpen] = useState(false);
  const [template, setTemplate] = useState<ProjectTemplateId>('empty');
  const availableTemplateIds = templates.length > 0
    ? templates.map((entry) => entry.id)
    : ['empty' as const];
  const normalizedName = name.trim();

  const resetForm = () => {
    setName('');
    setRootPath('');
    setTemplate('empty');
    setPathPickerOpen(false);
  };

  const closeDialog = () => {
    if (isCreating) {
      return;
    }
    resetForm();
    onOpenChange(false);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            onOpenChange(true);
            return;
          }
          closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('chatProjectCreateTitle')}</DialogTitle>
            <DialogDescription>{t('chatProjectCreateDescription')}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!normalizedName || isCreating) {
                return;
              }
              const normalizedRootPath = rootPath.trim();
              void onCreate({
                name: normalizedName,
                template,
                ...(normalizedRootPath ? { rootPath: normalizedRootPath } : {}),
              }).then(resetForm).catch(() => undefined);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="chat-project-name">{t('chatProjectNameLabel')}</Label>
              <Input
                id="chat-project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('chatProjectNamePlaceholder')}
                autoFocus
                disabled={isCreating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chat-project-template">{t('chatProjectTemplateLabel')}</Label>
              <Select
                value={template}
                onValueChange={(value) => setTemplate(value as ProjectTemplateId)}
                disabled={isCreating}
              >
                <SelectTrigger id="chat-project-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTemplateIds.map((templateId) => (
                    <SelectItem key={templateId} value={templateId}>
                      {projectTemplateLabel(templateId)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chat-project-root-path">{t('chatProjectPathLabel')}</Label>
              <div className="flex gap-2">
                <Input
                  id="chat-project-root-path"
                  value={rootPath}
                  onChange={(event) => setRootPath(event.target.value)}
                  placeholder={t('chatProjectPathPlaceholder')}
                  disabled={isCreating}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPathPickerOpen(true)}
                  disabled={isCreating}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {t('browse')}
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('chatProjectPathHint')}
              </p>
            </div>

            {errorMessage ? (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={isCreating}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={!normalizedName || isCreating}>
                {isCreating ? t('saving') : t('chatProjectCreateAction')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ServerPathPickerDialog
        open={pathPickerOpen}
        currentPath={rootPath}
        defaultWorkspacePath={defaultWorkspacePath}
        isSaving={false}
        onOpenChange={setPathPickerOpen}
        onConfirm={(path) => {
          setRootPath(path);
          setPathPickerOpen(false);
        }}
        title={t('chatProjectPathPickerTitle')}
        description={t('chatProjectPathPickerDescription')}
        pathLabel={t('chatProjectPathLabel')}
        pathPlaceholder={t('chatProjectPathPlaceholder')}
        confirmLabel={t('selectCurrentDirectory')}
        hint={t('chatProjectPathHint')}
      />
    </>
  );
}
