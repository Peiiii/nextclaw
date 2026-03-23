import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableModelInput } from '@/components/common/SearchableModelInput';
import { useConfig, useConfigMeta, useConfigSchema, useUpdateModel } from '@/hooks/useConfig';
import { hintForPath } from '@/lib/config-hints';
import { t } from '@/lib/i18n';
import {
  buildProviderModelCatalog,
  composeProviderModel,
  findProviderByModel,
  toProviderLocalModel
} from '@/lib/provider-models';
import { PageLayout, PageHeader } from '@/components/layout/page-layout';
import { DOCS_DEFAULT_BASE_URL } from '@/components/doc-browser/DocBrowserContext';
import { BookOpen, Folder, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export function ModelConfig() {
  const { data: config, isLoading } = useConfig();
  const { data: meta } = useConfigMeta();
  const { data: schema } = useConfigSchema();
  const updateModel = useUpdateModel();

  const [providerName, setProviderName] = useState('');
  const [modelId, setModelId] = useState('');
  const [workspace, setWorkspace] = useState('');
  const uiHints = schema?.uiHints;
  const modelHint = hintForPath('agents.defaults.model', uiHints);
  const workspaceHint = hintForPath('agents.defaults.workspace', uiHints);

  const providerCatalog = useMemo(
    () => buildProviderModelCatalog({ meta, config, onlyConfigured: true }),
    [config, meta]
  );

  const providerMap = useMemo(() => new Map(providerCatalog.map((provider) => [provider.name, provider])), [providerCatalog]);
  const selectedProvider = providerMap.get(providerName);
  const selectedProviderName = selectedProvider?.name ?? '';
  const selectedProviderAliases = useMemo(() => selectedProvider?.aliases ?? [], [selectedProvider]);
  const selectedProviderModels = useMemo(() => selectedProvider?.models ?? [], [selectedProvider]);

  useEffect(() => {
    if (!config?.agents?.defaults) {
      return;
    }
    const currentModel = (config.agents.defaults.model || '').trim();
    const matchedProvider = findProviderByModel(currentModel, providerCatalog);
    const effectiveProvider = matchedProvider ?? '';
    const aliases = providerMap.get(effectiveProvider)?.aliases ?? [];
    setProviderName(effectiveProvider);
    setModelId(effectiveProvider ? toProviderLocalModel(currentModel, aliases) : '');
    setWorkspace(config.agents.defaults.workspace || '');
  }, [config, providerCatalog, providerMap]);

  const modelOptions = useMemo(() => {
    const deduped = new Set<string>();
    for (const modelName of selectedProviderModels) {
      const trimmed = modelName.trim();
      if (trimmed) {
        deduped.add(trimmed);
      }
    }
    return [...deduped];
  }, [selectedProviderModels]);

  const composedModel = useMemo(() => {
    if (!selectedProvider) {
      return '';
    }
    const normalizedModelId = toProviderLocalModel(modelId, selectedProviderAliases);
    if (!normalizedModelId) {
      return '';
    }
    return composeProviderModel(selectedProvider.prefix, normalizedModelId);
  }, [modelId, selectedProvider, selectedProviderAliases]);

  const modelHelpText = t('modelIdentifierHelp') || modelHint?.help || '';

  const handleProviderChange = (nextProvider: string) => {
    setProviderName(nextProvider);
    setModelId('');
  };

  const handleModelChange = (nextModelId: string) => {
    if (!selectedProvider) {
      setModelId('');
      return;
    }
    setModelId(toProviderLocalModel(nextModelId, selectedProviderAliases));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateModel.mutate({
      model: composedModel,
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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="sm:w-[38%] sm:min-w-[170px]">
                  <Select value={selectedProviderName} onValueChange={handleProviderChange}>
                    <SelectTrigger className="h-10 w-full rounded-xl">
                      <SelectValue placeholder={t('providersSelectPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {providerCatalog.map((provider) => (
                        <SelectItem key={provider.name} value={provider.name}>
                          {provider.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <span className="hidden h-10 items-center justify-center leading-none text-lg font-semibold text-gray-300 sm:inline-flex">/</span>
                <SearchableModelInput
                  key={selectedProviderName}
                  id="model"
                  value={modelId}
                  onChange={handleModelChange}
                  options={modelOptions}
                  disabled={!selectedProviderName}
                  placeholder={modelHint?.placeholder ?? 'gpt-5.1'}
                  className="sm:flex-1"
                  inputClassName="h-10 rounded-xl"
                  emptyText={t('modelPickerNoOptions')}
                  createText={t('modelPickerUseCustom')}
                />
              </div>
              <p className="text-xs text-gray-400">{modelHelpText}</p>
              <p className="text-xs text-gray-500">{t('modelInputCustomHint')}</p>
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
