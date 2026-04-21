import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ProviderScopedModelInput } from '@/components/common/ProviderScopedModelInput';
import { useConfig, useConfigMeta, useConfigSchema, useUpdateModel } from '@/shared/hooks/use-config';
import { hintForPath } from '@/lib/config-hints';
import { t } from '@/lib/i18n';
import { buildProviderModelCatalog } from '@/lib/provider-models';
import { PageLayout, PageHeader } from '@/components/layout/page-layout';
import { DOCS_DEFAULT_BASE_URL } from '@/components/doc-browser/DocBrowserContext';
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
      className="space-y-8"
    >
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-card">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{t('defaultModel')}</h3>
          </div>
          <div className="space-y-2">
            <Label htmlFor="model" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {modelLabel}
            </Label>
            <ProviderScopedModelInput id="model" value={model} onChange={setModel} providerCatalog={providerCatalog} modelPlaceholder={modelPlaceholder} />
            <p className="text-xs text-gray-400">{modelHelpText}</p>
            <a href={`${DOCS_DEFAULT_BASE_URL}/guide/model-selection`} className="inline-flex items-center gap-1.5 text-xs text-primary transition-colors hover:text-primary-hover">
              <BookOpen className="h-3.5 w-3.5" />
              {t('channelsGuideTitle')}
            </a>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-card">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
              <Folder className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{t('workspace')}</h3>
          </div>
          <div className="space-y-2">
            <Label htmlFor="workspace" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {workspaceLabel}
            </Label>
            <Input id="workspace" value={workspace} onChange={(event) => setWorkspace(event.target.value)} placeholder={workspacePlaceholder} className="rounded-xl" />
          </div>
        </div>
      </div>
      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isPending} size="lg">
          {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : t('saveChanges')}
        </Button>
      </div>
    </form>
  );
}

export function ModelConfig() {
  const { data: config, isLoading } = useConfig();
  const { data: meta } = useConfigMeta();
  const { data: schema } = useConfigSchema();
  const updateModel = useUpdateModel();
  const uiHints = schema?.uiHints;
  const modelHint = hintForPath('agents.defaults.model', uiHints);
  const workspaceHint = hintForPath('agents.defaults.workspace', uiHints);

  const providerCatalog = useMemo(
    () => buildProviderModelCatalog({ meta, config, onlyConfigured: true }),
    [config, meta]
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
        <Card className="rounded-2xl border-gray-200 p-6">
          <div className="mb-6 flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="mb-2 h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </Card>
        <Card className="rounded-2xl border-gray-200 p-6">
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
