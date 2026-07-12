import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { FormActions } from '@/shared/components/ui/actions/form-actions';
import { ProviderScopedModelInput } from '@/shared/components/common/provider-scoped-model-input';
import { useConfig, useConfigSchema, useProviderTemplates, useProviders, useUpdateModel } from '@/shared/hooks/use-config';
import { hintForPath } from '@/shared/lib/config-hints';
import { t } from '@/shared/lib/i18n';
import { buildProviderModelCatalog } from '@/shared/lib/provider-models';
import { PageLayout, PageHeader } from '@/app/components/layout/page-layout';
import { getDocsUrl } from '@/shared/components/doc-browser/doc-browser-context';
import { BookOpen, Folder, Loader2, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';

const DEFAULT_MODEL_INPUT_PLACEHOLDER = 'provider/model';

function ModelConfigForm(props: {
  initialModel: string;
  initialWorkspace: string;
  isPending: boolean;
  modelHelpText: string;
  modelLabel: string;
  modelPlaceholder: string;
  onSubmit: (payload: { model: string; workspace: string }) => void;
  providerCatalog: ReturnType<typeof buildProviderModelCatalog>;
  workspaceLabel: string;
  workspacePlaceholder: string;
}) {
  const { initialModel, initialWorkspace, isPending, modelHelpText, modelLabel, modelPlaceholder, onSubmit, providerCatalog, workspaceLabel, workspacePlaceholder } = props;
  const [model, setModel] = useState(initialModel);
  const [workspace, setWorkspace] = useState(initialWorkspace);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ model, workspace });
      }}
      className="space-y-5"
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-border/75 bg-card p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-base font-semibold text-foreground">{t('defaultModel')}</h3>
          </div>
          <div className="space-y-2">
            <Label htmlFor="model" className="text-xs font-medium text-muted-foreground">
              {modelLabel}
            </Label>
            <ProviderScopedModelInput id="model" value={model} onChange={setModel} providerCatalog={providerCatalog} modelPlaceholder={modelPlaceholder} />
            <p className="text-xs text-muted-foreground/80">{modelHelpText}</p>
            <a href={getDocsUrl('/guide/model-selection')} className="inline-flex items-center gap-1.5 text-xs text-primary transition-colors hover:text-primary-hover">
              <BookOpen className="h-3.5 w-3.5" />
              {t('channelsGuideTitle')}
            </a>
          </div>
        </div>
        <div className="rounded-2xl border border-border/75 bg-card p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Folder className="h-4 w-4" />
            </div>
            <h3 className="text-base font-semibold text-foreground">{t('workspace')}</h3>
          </div>
          <div className="space-y-2">
            <Label htmlFor="workspace" className="text-xs font-medium text-muted-foreground">
              {workspaceLabel}
            </Label>
            <Input id="workspace" value={workspace} onChange={(event) => setWorkspace(event.target.value)} placeholder={workspacePlaceholder} className="rounded-xl" />
          </div>
        </div>
      </div>
      <FormActions>
        <Button type="submit" disabled={isPending} size="sm">
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('saveChanges')}
        </Button>
      </FormActions>
    </form>
  );
}

export function ModelConfigPage() {
  const { data: config, isLoading } = useConfig();
  const { data: providersView } = useProviders();
  const { data: templatesView } = useProviderTemplates();
  const { data: schema } = useConfigSchema();
  const updateModel = useUpdateModel();
  const uiHints = schema?.uiHints;
  const modelHint = hintForPath('agents.defaults.model', uiHints);
  const workspaceHint = hintForPath('agents.defaults.workspace', uiHints);

  const providerCatalog = useMemo(
    () => buildProviderModelCatalog({ providersView, templatesView, config, onlyConfigured: true }),
    [config, providersView, templatesView]
  );
  const modelHelpText = t('modelIdentifierHelp') || modelHint?.help || '';
  const initialModel = (config?.agents?.defaults?.model || '').trim();
  const initialWorkspace = config?.agents?.defaults?.workspace || '';

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Card hover={false} className="rounded-2xl border-border/75 p-6 shadow-none">
          <div className="mb-6 flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="mb-2 h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </Card>
        <Card hover={false} className="rounded-2xl border-border/75 p-6 shadow-none">
          <Skeleton className="mb-2 h-5 w-24" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </Card>
      </div>
    );
  }

  return (
    <PageLayout>
      <PageHeader title={t('modelPageTitle')} description={t('modelPageDescription')} />
      <ModelConfigForm
        key={`${initialModel}::${initialWorkspace}`}
        initialModel={initialModel}
        initialWorkspace={initialWorkspace}
        isPending={updateModel.isPending}
        modelHelpText={modelHelpText}
        modelLabel={modelHint?.label ?? 'Model Name'}
        modelPlaceholder={modelHint?.placeholder ?? DEFAULT_MODEL_INPUT_PLACEHOLDER}
        onSubmit={({ model, workspace }) =>
          updateModel.mutate({
            model,
            workspace
          })}
        providerCatalog={providerCatalog}
        workspaceLabel={workspaceHint?.label ?? 'Default Path'}
        workspacePlaceholder={workspaceHint?.placeholder ?? '/path/to/workspace'}
      />
    </PageLayout>
  );
}
