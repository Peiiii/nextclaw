import { useEffect, useMemo, useState } from 'react';
import { CircleDotDashed, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useConfigSchema,
  useDeleteProvider,
  useProviders,
  useProviderTemplates,
  useTestProviderConnection,
  useUpdateProvider
} from '@/shared/hooks/use-config';
import { MaskedInput } from '@/shared/components/common/masked-input';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { getLanguage, t } from '@/shared/lib/i18n';
import type { ThinkingLevel } from '@/shared/lib/api';
import {
  ConfigSplitDetailPane,
  ConfigSplitEmptyPane,
  ConfigSplitPaneBody,
  ConfigSplitPaneFooter,
  ConfigSplitPaneHeader
} from '@/shared/components/config-split-page';
import { ProviderAdvancedSettingsSection } from '@/features/settings/components/config/provider-advanced-settings-section';
import { ProviderAuthSection } from '@/features/settings/components/config/provider-auth-section';
import {
  buildProviderConnectionTestPayload,
  buildProviderSavePayload,
  formatThinkingLevelLabel,
  hasProviderFormChanges,
  normalizeModelConfigForModels,
  THINKING_LEVELS,
  type ModelConfig,
  type WireApiType
} from '@/features/settings/utils/provider-form-support.utils';
import {
  addProviderLocalModel,
  removeProviderLocalModel,
  setModelThinkingDefaultInConfig,
  setModelVisionInConfig,
  toggleModelThinkingLevelInConfig
} from '@/features/settings/utils/provider-form-model.utils';
import { resolveProviderFormContext } from '@/features/settings/utils/provider-form-context.utils';
import { ProviderModelsSection } from './provider-models-section';
import { ProviderStatusBadge } from '@/features/settings/components/config/provider-status-badge';
import { useProviderAuthFlow } from '@/features/settings/hooks/use-provider-auth-flow';
type ProviderFormProps = {
  providerName?: string;
  onProviderDeleted?: (providerName: string) => void;
};
type ProviderFormContext = ReturnType<typeof resolveProviderFormContext>;
type ProviderFormDetailPaneProps = {
  context: ProviderFormContext;
  language: ReturnType<typeof getLanguage>;
  providerTitle: string;
  providerDisplayName: string;
  apiKey: string;
  apiBase: string;
  extraHeaders: Record<string, string> | null;
  wireApi: WireApiType;
  models: string[];
  modelConfig: ModelConfig;
  modelDraft: string;
  showAdvanced: boolean;
  showModelInput: boolean;
  resolvedAuthMethodId: string;
  authSessionId: string | null;
  authStatusMessage: string;
  hasChanges: boolean;
  isDeletePending: boolean;
  isUpdatePending: boolean;
  isTestPending: boolean;
  startPending: boolean;
  importPending: boolean;
  onProviderDisplayNameChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onApiBaseChange: (value: string) => void;
  onAuthMethodChange: (value: string) => void;
  onStartProviderAuth: () => void;
  onImportProviderAuthFromCli: () => void;
  onModelDraftChange: (value: string) => void;
  onShowModelInputChange: (show: boolean) => void;
  onAddModel: () => void;
  onRemoveModel: (modelName: string) => void;
  onToggleModelThinkingLevel: (modelName: string, level: ThinkingLevel) => void;
  onSetModelThinkingDefault: (modelName: string, level: ThinkingLevel | null) => void;
  onSetModelVision: (modelName: string, vision: boolean) => void;
  onShowAdvancedChange: (show: boolean) => void;
  onWireApiChange: (wireApi: WireApiType) => void;
  onExtraHeadersChange: (headers: Record<string, string> | null) => void;
  onDeleteProvider: () => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onTestConnection: () => void;
};

export function ProviderForm({ providerName, onProviderDeleted }: ProviderFormProps) {
  const { data: providersView } = useProviders();
  const { data: templatesView } = useProviderTemplates();
  const { data: schema } = useConfigSchema();
  const updateProvider = useUpdateProvider();
  const deleteProvider = useDeleteProvider();
  const testProviderConnection = useTestProviderConnection();

  const [apiKey, setApiKey] = useState('');
  const [apiBase, setApiBase] = useState('');
  const [extraHeaders, setExtraHeaders] = useState<Record<string, string> | null>(null);
  const [wireApi, setWireApi] = useState<WireApiType>('auto');
  const [models, setModels] = useState<string[]>([]);
  const [modelConfig, setModelConfig] = useState<ModelConfig>({});
  const [modelDraft, setModelDraft] = useState('');
  const [providerDisplayName, setProviderDisplayName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showModelInput, setShowModelInput] = useState(false);
  const [authMethodId, setAuthMethodId] = useState('');

  const language = getLanguage();
  const providerFormContext = useMemo(
    () => resolveProviderFormContext({ providerName, providersView, templatesView, schema, language }),
    [language, providerName, providersView, schema, templatesView]
  );
  const {
    currentApiBase,
    currentEditableModels,
    currentHeaders,
    currentModelConfig,
    currentWireApi,
    defaultApiBase,
    effectiveDisplayName,
    providerAuth,
    providerAuthMethods,
    providerConfig,
    providerModelAliases,
    resolvedProviderConfig,
    preferredAuthMethodId,
    supportsWireApi,
  } = providerFormContext;
  const providerTitle = providerDisplayName.trim() || effectiveDisplayName || providerName || t('providersSelectPlaceholder');
  const resolvedAuthMethodId = useMemo(() => {
    if (!providerAuthMethods.length) {
      return '';
    }
    const normalizedCurrent = authMethodId.trim();
    if (normalizedCurrent && providerAuthMethods.some((method) => method.id === normalizedCurrent)) {
      return normalizedCurrent;
    }
    return preferredAuthMethodId || providerAuthMethods[0]?.id || '';
  }, [authMethodId, preferredAuthMethodId, providerAuthMethods]);
  const {
    authSessionId,
    authStatusMessage,
    importAuthFromCli,
    importPending,
    startAuth,
    startPending
  } = useProviderAuthFlow({ providerName, providerAuth, resolvedAuthMethodId });

  useEffect(() => {
    if (!providerName) {
      setApiKey('');
      setApiBase('');
      setExtraHeaders(null);
      setWireApi('auto');
      setModels([]);
      setModelConfig({});
      setModelDraft('');
      setProviderDisplayName('');
      setAuthMethodId('');
      return;
    }

    setApiKey('');
    setApiBase(currentApiBase);
    setExtraHeaders(resolvedProviderConfig.extraHeaders || null);
    setWireApi(currentWireApi);
    setModels(currentEditableModels);
    setModelConfig(currentModelConfig);
    setModelDraft('');
    setProviderDisplayName(effectiveDisplayName);
    setAuthMethodId(preferredAuthMethodId);
  }, [
    providerName,
    currentApiBase,
    resolvedProviderConfig.extraHeaders,
    currentWireApi,
    currentEditableModels,
    currentModelConfig,
    effectiveDisplayName,
    preferredAuthMethodId
  ]);

  useEffect(() => setModelConfig((prev) => normalizeModelConfigForModels(prev, models)), [models]);

  const hasChanges = useMemo(() => {
    return hasProviderFormChanges({
      providerName,
      apiKey,
      apiBase,
      currentApiBase,
      extraHeaders,
      currentHeaders,
      supportsWireApi,
      wireApi,
      currentWireApi,
      models,
      currentEditableModels,
      modelConfig,
      currentModelConfig,
      providerDisplayName,
      effectiveDisplayName
    });
  }, [
    providerName,
    apiKey,
    apiBase,
    currentApiBase,
    extraHeaders,
    currentHeaders,
    supportsWireApi,
    wireApi,
    currentWireApi,
    models,
    currentEditableModels,
    modelConfig,
    currentModelConfig,
    providerDisplayName,
    effectiveDisplayName
  ]);

  const handleAddModel = () => {
    const result = addProviderLocalModel(models, modelDraft, providerModelAliases);
    if (result.errorKey) {
      toast.error(t('providerModelInvalidProviderPrefix'));
      return;
    }
    setModels(result.models);
    setModelDraft(result.draft);
  };

  const toggleModelThinkingLevel = (modelName: string, level: ThinkingLevel) => {
    setModelConfig((prev) => toggleModelThinkingLevelInConfig(prev, modelName, level));
  };

  const setModelThinkingDefault = (modelName: string, level: ThinkingLevel | null) => {
    setModelConfig((prev) => setModelThinkingDefaultInConfig(prev, modelName, level));
  };

  const setModelVision = (modelName: string, vision: boolean) => {
    setModelConfig((prev) => setModelVisionInConfig(prev, modelName, vision));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerName) {
      return;
    }

    updateProvider.mutate({
      provider: providerName,
      data: buildProviderSavePayload({
        providerName,
        apiKey,
        apiBase,
        currentApiBase,
        defaultApiBase,
        extraHeaders,
        currentHeaders,
        supportsWireApi,
        wireApi,
        currentWireApi,
        models,
        currentEditableModels,
        modelConfig,
        currentModelConfig,
        providerDisplayName,
        effectiveDisplayName
      })
    });
  };

  const handleTestConnection = async () => {
    if (!providerName) {
      return;
    }
    try {
      const result = await testProviderConnection.mutateAsync({
        provider: providerName,
        data: buildProviderConnectionTestPayload({
          apiKey,
          apiBase,
          extraHeaders,
          supportsWireApi,
          wireApi,
          models,
          providerModelAliases
        })
      });
      if (result.success) {
        toast.success(`${t('providerTestConnectionSuccess')} (${result.latencyMs}ms)`);
        return;
      }
      const details = [`provider=${result.provider}`, `latency=${result.latencyMs}ms`];
      if (result.model) {
        details.push(`model=${result.model}`);
      }
      toast.error(`${t('providerTestConnectionFailed')}: ${result.message} | ${details.join(' | ')}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`${t('providerTestConnectionFailed')}: ${message}`);
    }
  };

  const handleDeleteProvider = async () => {
    if (!providerName) {
      return;
    }
    if (!window.confirm(t('providerDeleteConfirm'))) {
      return;
    }
    try {
      await deleteProvider.mutateAsync({ provider: providerName });
      onProviderDeleted?.(providerName);
    } catch {
      // toast handled by mutation hook
    }
  };

  if (!providerName || !providerConfig) {
    return (
      <ConfigSplitEmptyPane>
        <div>
          <h3 className='text-base font-semibold text-foreground'>{t('providersSelectTitle')}</h3>
          <p className='mt-2 text-sm text-muted-foreground'>{t('providersSelectDescription')}</p>
        </div>
      </ConfigSplitEmptyPane>
    );
  }

  return (
    <ProviderFormDetailPane
      context={providerFormContext}
      language={language}
      providerTitle={providerTitle}
      providerDisplayName={providerDisplayName}
      apiKey={apiKey}
      apiBase={apiBase}
      extraHeaders={extraHeaders}
      wireApi={wireApi}
      models={models}
      modelConfig={modelConfig}
      modelDraft={modelDraft}
      showAdvanced={showAdvanced}
      showModelInput={showModelInput}
      resolvedAuthMethodId={resolvedAuthMethodId}
      authSessionId={authSessionId}
      authStatusMessage={authStatusMessage}
      hasChanges={hasChanges}
      isDeletePending={deleteProvider.isPending}
      isUpdatePending={updateProvider.isPending}
      isTestPending={testProviderConnection.isPending}
      startPending={startPending}
      importPending={importPending}
      onProviderDisplayNameChange={setProviderDisplayName}
      onApiKeyChange={setApiKey}
      onApiBaseChange={setApiBase}
      onAuthMethodChange={setAuthMethodId}
      onStartProviderAuth={startAuth}
      onImportProviderAuthFromCli={importAuthFromCli}
      onModelDraftChange={setModelDraft}
      onShowModelInputChange={setShowModelInput}
      onAddModel={handleAddModel}
      onRemoveModel={(modelName) => {
        const next = removeProviderLocalModel(models, modelConfig, modelName);
        setModels(next.models);
        setModelConfig(next.modelConfig);
      }}
      onToggleModelThinkingLevel={toggleModelThinkingLevel}
      onSetModelThinkingDefault={setModelThinkingDefault}
      onSetModelVision={setModelVision}
      onShowAdvancedChange={setShowAdvanced}
      onWireApiChange={setWireApi}
      onExtraHeadersChange={setExtraHeaders}
      onDeleteProvider={handleDeleteProvider}
      onSubmit={handleSubmit}
      onTestConnection={handleTestConnection}
    />
  );
}

function ProviderFormDetailPane(props: ProviderFormDetailPaneProps) {
  const {
    context,
    language,
    providerTitle,
    providerDisplayName,
    apiKey,
    apiBase,
    extraHeaders,
    wireApi,
    models,
    modelConfig,
    modelDraft,
    showAdvanced,
    showModelInput,
    resolvedAuthMethodId,
    authSessionId,
    authStatusMessage,
    hasChanges,
    isDeletePending,
    isUpdatePending,
    isTestPending,
    startPending,
    importPending,
    onProviderDisplayNameChange,
    onApiKeyChange,
    onApiBaseChange,
    onAuthMethodChange,
    onStartProviderAuth,
    onImportProviderAuthFromCli,
    onModelDraftChange,
    onShowModelInputChange,
    onAddModel,
    onRemoveModel,
    onToggleModelThinkingLevel,
    onSetModelThinkingDefault,
    onSetModelVision,
    onShowAdvancedChange,
    onWireApiChange,
    onExtraHeadersChange,
    onDeleteProvider,
    onSubmit,
    onTestConnection
  } = props;
  const selectedAuthMethod = context.providerAuthMethods.find((method) => method.id === resolvedAuthMethodId);

  return (
    <ConfigSplitDetailPane>
      <ConfigSplitPaneHeader className='px-6 py-4'>
        <div className='flex items-center justify-between'>
          <h3 className='truncate text-lg font-semibold text-foreground'>{providerTitle}</h3>
          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={onDeleteProvider}
              disabled={isDeletePending}
              className='text-muted-foreground/70 transition-colors hover:text-red-500'
              title={t('providerDelete')}
            >
              <Trash2 className='h-4 w-4' />
            </button>
            <ProviderStatusBadge enabled={context.currentEnabled} apiKeySet={context.resolvedProviderConfig.apiKeySet} />
          </div>
        </div>
      </ConfigSplitPaneHeader>

      <form onSubmit={onSubmit} className='flex min-h-0 flex-1 flex-col'>
        <ConfigSplitPaneBody className='space-y-5 px-6 py-5'>
          <div className='space-y-2'>
            <Label htmlFor='providerDisplayName' className='text-sm font-medium text-foreground'>
              {t('providerDisplayName')}
            </Label>
            <Input
              id='providerDisplayName'
              type='text'
              value={providerDisplayName}
              onChange={(e) => onProviderDisplayNameChange(e.target.value)}
              placeholder={context.defaultDisplayName || t('providerDisplayNamePlaceholder')}
              className='rounded-xl'
            />
            <p className='text-xs text-muted-foreground'>{t('providerDisplayNameHelpShort')}</p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='apiKey' className='text-sm font-medium text-foreground'>
              {context.apiKeyHint?.label ?? t('apiKey')}
            </Label>
            <MaskedInput
              id='apiKey'
              value={apiKey}
              isSet={context.resolvedProviderConfig.apiKeySet}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder={context.apiKeyHint?.placeholder ?? t('enterApiKey')}
              className='rounded-xl'
            />
            <p className='text-xs text-muted-foreground'>{t('leaveBlankToKeepUnchanged')}</p>
          </div>

          <ProviderAuthSection
            providerAuth={context.providerAuth}
            providerAuthNote={context.providerAuth?.note?.[language] || context.providerAuth?.note?.en || context.providerAuth?.displayName || ''}
            providerAuthMethodOptions={context.providerAuthMethodOptions}
            providerAuthMethodsCount={context.providerAuthMethods.length}
            selectedAuthMethodHint={selectedAuthMethod?.hint?.[language] || selectedAuthMethod?.hint?.en || ''}
            shouldUseAuthMethodPills={context.shouldUseAuthMethodPills}
            resolvedAuthMethodId={resolvedAuthMethodId}
            onAuthMethodChange={onAuthMethodChange}
            onStartProviderAuth={onStartProviderAuth}
            onImportProviderAuthFromCli={onImportProviderAuthFromCli}
            startPending={startPending}
            importPending={importPending}
            authSessionId={authSessionId}
            authStatusMessage={authStatusMessage}
          />

          <div className='space-y-2'>
            <Label htmlFor='apiBase' className='text-sm font-medium text-foreground'>
              {context.apiBaseHint?.label ?? t('apiBase')}
            </Label>
            <Input
              id='apiBase'
              type='text'
              value={apiBase}
              onChange={(e) => onApiBaseChange(e.target.value)}
              placeholder={context.defaultApiBase || context.apiBaseHint?.placeholder || 'https://api.example.com'}
              className='rounded-xl'
            />
            <p className='text-xs text-muted-foreground'>{context.apiBaseHelpText}</p>
          </div>

          <ProviderModelsSection
            models={models}
            modelConfig={modelConfig}
            modelDraft={modelDraft}
            showModelInput={showModelInput}
            onModelDraftChange={onModelDraftChange}
            onShowModelInputChange={onShowModelInputChange}
            onAddModel={onAddModel}
            onRemoveModel={onRemoveModel}
            onToggleModelThinkingLevel={onToggleModelThinkingLevel}
            onSetModelThinkingDefault={onSetModelThinkingDefault}
            onSetModelVision={onSetModelVision}
            thinkingLevels={THINKING_LEVELS}
            formatThinkingLevelLabel={formatThinkingLevelLabel}
          />

          <ProviderAdvancedSettingsSection
            showAdvanced={showAdvanced}
            onShowAdvancedChange={onShowAdvancedChange}
            supportsWireApi={context.supportsWireApi}
            wireApiLabel={context.wireApiHint?.label ?? t('wireApi')}
            wireApi={wireApi}
            onWireApiChange={onWireApiChange}
            shouldUseWireApiPills={context.shouldUseWireApiPills}
            wireApiSelectOptions={context.wireApiSelectOptions}
            extraHeadersLabel={context.extraHeadersHint?.label ?? t('extraHeaders')}
            extraHeaders={extraHeaders}
            onExtraHeadersChange={onExtraHeadersChange}
          />
        </ConfigSplitPaneBody>

        <ConfigSplitPaneFooter className='flex items-center justify-between px-6 py-4'>
          <Button type='button' variant='outline' size='sm' onClick={onTestConnection} disabled={isTestPending}>
            <CircleDotDashed className='mr-1.5 h-4 w-4' />
            {isTestPending ? t('providerTestingConnection') : t('providerTestConnection')}
          </Button>
          <Button type='submit' disabled={isUpdatePending || !hasChanges}>
            {isUpdatePending ? t('saving') : hasChanges ? t('save') : t('unchanged')}
          </Button>
        </ConfigSplitPaneFooter>
      </form>
    </ConfigSplitDetailPane>
  );
}
