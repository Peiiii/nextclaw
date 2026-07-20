import { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import type {
  ProjectAddExistingRequest,
  ProjectCreateRequest,
  ProjectTemplateView,
} from '@/shared/lib/api';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { t } from '@/shared/lib/i18n';

type ProjectTemplateId = NonNullable<ProjectCreateRequest['template']>;
type ProjectAddMode = 'create' | 'existing';

type ChatProjectAddDialogProps = {
  open: boolean;
  defaultWorkspacePath?: string | null;
  templates: readonly ProjectTemplateView[];
  isCreating: boolean;
  isAddingExisting: boolean;
  createErrorMessage?: string | null;
  addExistingErrorMessage?: string | null;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: ProjectCreateRequest) => Promise<void>;
  onAddExisting: (input: ProjectAddExistingRequest) => Promise<void>;
};

function projectTemplateLabel(templateId: ProjectTemplateId): string {
  return t(
    templateId === 'knowledge-base'
      ? 'chatProjectTemplateKnowledgeBase'
      : 'chatProjectTemplateEmpty',
  );
}

export function ChatProjectAddDialog({
  open,
  defaultWorkspacePath,
  templates,
  isCreating,
  isAddingExisting,
  createErrorMessage,
  addExistingErrorMessage,
  onOpenChange,
  onCreate,
  onAddExisting,
}: ChatProjectAddDialogProps) {
  const [mode, setMode] = useState<ProjectAddMode>('create');
  const [name, setName] = useState('');
  const [createRootPath, setCreateRootPath] = useState('');
  const [existingRootPath, setExistingRootPath] = useState('');
  const [pathPickerOpen, setPathPickerOpen] = useState(false);
  const [template, setTemplate] = useState<ProjectTemplateId>('empty');
  const availableTemplateIds = templates.length > 0
    ? templates.map((entry) => entry.id)
    : ['empty' as const];
  const normalizedName = name.trim();
  const normalizedCreateRootPath = createRootPath.trim();
  const normalizedExistingRootPath = existingRootPath.trim();
  const isSubmitting = isCreating || isAddingExisting;
  const submitDisabled = isSubmitting || (
    mode === 'create' ? !normalizedName : !normalizedExistingRootPath
  );
  const errorMessage = mode === 'create' ? createErrorMessage : addExistingErrorMessage;

  const resetForm = () => {
    setMode('create');
    setName('');
    setCreateRootPath('');
    setExistingRootPath('');
    setTemplate('empty');
    setPathPickerOpen(false);
  };

  const closeDialog = () => {
    if (isSubmitting) {
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
            <DialogTitle>{t('chatProjectAddTitle')}</DialogTitle>
            <DialogDescription>{t('chatProjectAddDescription')}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (submitDisabled) {
                return;
              }
              const submit = mode === 'create'
                ? onCreate({
                    name: normalizedName,
                    template,
                    rootPath: normalizedCreateRootPath || undefined,
                  })
                : onAddExisting({ rootPath: normalizedExistingRootPath });
              void submit.then(resetForm).catch(() => undefined);
            }}
          >
            <Tabs
              value={mode}
              onValueChange={(value) => {
                if (!isSubmitting) {
                  setMode(value === 'existing' ? 'existing' : 'create');
                }
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="create">{t('chatProjectCreateMode')}</TabsTrigger>
                <TabsTrigger value="existing">{t('chatProjectExistingMode')}</TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="mt-4 space-y-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t('chatProjectCreateModeDescription')}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="chat-project-name">{t('chatProjectNameLabel')}</Label>
                  <Input
                    id="chat-project-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t('chatProjectNamePlaceholder')}
                    autoFocus
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chat-project-template">{t('chatProjectTemplateLabel')}</Label>
                  <Select
                    value={template}
                    onValueChange={(value) => setTemplate(value as ProjectTemplateId)}
                    disabled={isSubmitting}
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
                  <Label htmlFor="chat-project-create-root-path">
                    {t('chatProjectCreatePathLabel')}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="chat-project-create-root-path"
                      value={createRootPath}
                      onChange={(event) => setCreateRootPath(event.target.value)}
                      placeholder={t('chatProjectCreatePathPlaceholder')}
                      disabled={isSubmitting}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPathPickerOpen(true)}
                      disabled={isSubmitting}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" />
                      {t('browse')}
                    </Button>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t('chatProjectCreatePathHint')}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="existing" className="mt-4 space-y-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t('chatProjectExistingModeDescription')}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="chat-project-existing-root-path">
                    {t('chatProjectExistingPathLabel')}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="chat-project-existing-root-path"
                      value={existingRootPath}
                      onChange={(event) => setExistingRootPath(event.target.value)}
                      placeholder={t('chatProjectExistingPathPlaceholder')}
                      autoFocus
                      disabled={isSubmitting}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPathPickerOpen(true)}
                      disabled={isSubmitting}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" />
                      {t('browse')}
                    </Button>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t('chatProjectExistingPathHint')}
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {errorMessage ? (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={submitDisabled}>
                {isSubmitting
                  ? t('saving')
                  : t(mode === 'create' ? 'chatProjectCreateAction' : 'chatProjectExistingAction')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ServerPathPickerDialog
        open={pathPickerOpen}
        allowCreateDirectory={mode === 'create'}
        currentPath={mode === 'create' ? createRootPath : existingRootPath}
        defaultWorkspacePath={defaultWorkspacePath}
        isSaving={false}
        onOpenChange={setPathPickerOpen}
        onConfirm={(path) => {
          if (mode === 'create') {
            setCreateRootPath(path);
          } else {
            setExistingRootPath(path);
          }
          setPathPickerOpen(false);
        }}
        title={t(
          mode === 'create'
            ? 'chatProjectCreatePathPickerTitle'
            : 'chatProjectExistingPathPickerTitle',
        )}
        description={t(
          mode === 'create'
            ? 'chatProjectCreatePathPickerDescription'
            : 'chatProjectExistingPathPickerDescription',
        )}
        pathLabel={t(
          mode === 'create' ? 'chatProjectCreatePathLabel' : 'chatProjectExistingPathLabel',
        )}
        pathPlaceholder={t(
          mode === 'create'
            ? 'chatProjectCreatePathPlaceholder'
            : 'chatProjectExistingPathPlaceholder',
        )}
        confirmLabel={t('selectCurrentDirectory')}
        hint={t(
          mode === 'create' ? 'chatProjectCreatePathHint' : 'chatProjectExistingPathHint',
        )}
      />
    </>
  );
}
