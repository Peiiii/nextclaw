import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ProviderScopedModelInput } from '@/components/common/ProviderScopedModelInput';
import { useConfig, useConfigMeta, useConfigSchema, useUpdateModel } from '@/hooks/useConfig';
import { hintForPath } from '@/lib/config-hints';
import { t } from '@/lib/i18n';
import { buildProviderModelCatalog } from '@/lib/provider-models';
import { PageLayout, PageHeader } from '@/components/layout/page-layout';
import { DOCS_DEFAULT_BASE_URL } from '@/components/doc-browser/DocBrowserContext';
import { BookOpen, Folder, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const DEFAULT_MODEL_INPUT_PLACEHOLDER = 'provider/model';

export function ModelConfig() {
  const { data: config, isLoading } = useConfig();
  const { data: meta } = useConfigMeta();
  const { data: schema } = useConfigSchema();
  const updateModel = useUpdateModel();

  const [model, setModel] = useState('');
  const [workspace, setWorkspace] = useState('');
  const uiHints = schema?.uiHints;
  const modelHint = hintForPath('agents.defaults.model', uiHints);
  const workspaceHint = hintForPath('agents.defaults.workspace', uiHints);

  const providerCatalog = useMemo(
    () => buildProviderModelCatalog({ meta, config, onlyConfigured: true }),
    [config, meta]
  );

  useEffect(() => {
    if (!config?.agents?.defaults) {
      return;
    }
    setModel((config.agents.defaults.model || '').trim());
    setWorkspace(config.agents.defaults.workspace || '');
  }, [config]);

  const modelHelpText = t('modelIdentifierHelp') || modelHint?.help || '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateModel.mutate({
      model,
      workspace
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Card className="rounded-2xl border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </Card>
        <Card className="rounded-2xl border-gray-200 p-6">
          <Skeleton className="h-5 w-24 mb-2" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </Card>
      </div>
    );
  }

  return (
    <PageLayout>
      <PageHeader title={t('modelPageTitle')} description={t('modelPageDescription')} />

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Model Card */}
          <div className="p-8 rounded-2xl bg-white border border-gray-200 shadow-card">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{t('defaultModel')}</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {modelHint?.label ?? 'Model Name'}
              </Label>
              <ProviderScopedModelInput
                id="model"
                value={model}
                onChange={setModel}
                providerCatalog={providerCatalog}
                modelPlaceholder={modelHint?.placeholder ?? DEFAULT_MODEL_INPUT_PLACEHOLDER}
              />
              <p className="text-xs text-gray-400">{modelHelpText}</p>
              <a
                href={`${DOCS_DEFAULT_BASE_URL}/guide/model-selection`}
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary-hover transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5" />
                {t('channelsGuideTitle')}
              </a>
            </div>
          </div>

          {/* Workspace Card */}
          <div className="p-8 rounded-2xl bg-white border border-gray-200 shadow-card">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white">
                <Folder className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{t('workspace')}</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspace" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {workspaceHint?.label ?? 'Default Path'}
              </Label>
              <Input
                id="workspace"
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder={workspaceHint?.placeholder ?? '/path/to/workspace'}
                className="rounded-xl"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            disabled={updateModel.isPending}
            size="lg"
          >
            {updateModel.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              t('saveChanges')
            )}
          </Button>
        </div>
      </form>
    </PageLayout>
  );
}
