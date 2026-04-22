import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CircleDotDashed, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useConfig,
  useConfigMeta,
  useConfigSchema,
  useDeleteProvider,
  useImportProviderAuthFromCli,
  usePollProviderAuth,
  useStartProviderAuth,
  useTestProviderConnection,
  useUpdateProvider
} from '@/shared/hooks/use-config';
import { MaskedInput } from '@/shared/components/common/masked-input';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { hintForPath } from '@/shared/lib/config-hints';
import { getLanguage, t } from '@/shared/lib/i18n';
import type { ProviderConfigUpdate, ProviderConnectionTestRequest, ThinkingLevel } from '@/shared/lib/api';
import {
  ConfigSplitDetailPane,
  ConfigSplitEmptyPane,
  ConfigSplitPaneBody,
  ConfigSplitPaneFooter,
  ConfigSplitPaneHeader
} from '../config-split-page';
import { ProviderAdvancedSettingsSection } from '../provider-advanced-settings-section';
import { ProviderAuthSection } from '../provider-auth-section';
import { ProviderEnabledField } from '../provider-enabled-field';
import {
  applyEnabledPatch,
  EMPTY_PROVIDER_CONFIG,
  formatThinkingLevelLabel,
  headersEqual,
  modelListsEqual,
  modelThinkingEqual,
  normalizeHeaders,
  normalizeModelList,
  normalizeModelThinkingConfig,
  normalizeModelThinkingForModels,
  resolveEditableModels,
  resolvePreferredAuthMethodId,
  serializeModelsForSave,
  shouldUsePillSelector,
  THINKING_LEVELS,
  toProviderLocalModelId,
  type ModelThinkingConfig,
  type WireApiType
} from './provider-form-support';
import { ProviderModelsSection } from './provider-models-section';
import type { PillSelectOption } from '../provider-pill-selector';
import { ProviderStatusBadge } from '../provider-status-badge';

type ProviderFormProps = {
  providerName?: string;
  onProviderDeleted?: (providerName: string) => void;
};

export function ProviderForm({ providerName, onProviderDeleted }: ProviderFormProps) {
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const { data: meta } = useConfigMeta();
  const { data: schema } = useConfigSchema();
  const updateProvider = useUpdateProvider();
  const deleteProvider = useDeleteProvider();
  const testProviderConnection = useTestProviderConnection();
  const startProviderAuth = useStartProviderAuth();
  const pollProviderAuth = usePollProviderAuth();
  const importProviderAuthFromCli = useImportProviderAuthFromCli();

  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [apiBase, setApiBase] = useState('');
  const [extraHeaders, setExtraHeaders] = useState<Record<string, string> | null>(null);
  const [wireApi, setWireApi] = useState<WireApiType>('auto');
  const [models, setModels] = useState<string[]>([]);
  const [modelThinking, setModelThinking] = useState<ModelThinkingConfig>({});
  const [modelDraft, setModelDraft] = useState('');
  const [providerDisplayName, setProviderDisplayName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showModelInput, setShowModelInput] = useState(false);
  const [authSessionId, setAuthSessionId] = useState<string | null>(null);
  const [authStatusMessage, setAuthStatusMessage] = useState('');
  const [authMethodId, setAuthMethodId] = useState('');
  const authPollTimerRef = useRef<number | null>(null);

  const providerSpec = meta?.providers.find((p) => p.name === providerName);
  const providerConfig = providerName ? config?.providers[providerName] : null;
  const resolvedProviderConfig = providerConfig ?? EMPTY_PROVIDER_CONFIG;
  const uiHints = schema?.uiHints;
  const isCustomProvider = Boolean(providerSpec?.isCustom);
  const apiKeyHint = providerName ? hintForPath(`providers.${providerName}.apiKey`, uiHints) : undefined;
  const apiBaseHint = providerName ? hintForPath(`providers.${providerName}.apiBase`, uiHints) : undefined;
  const extraHeadersHint = providerName ? hintForPath(`providers.${providerName}.extraHeaders`, uiHints) : undefined;
  const wireApiHint = providerName ? hintForPath(`providers.${providerName}.wireApi`, uiHints) : undefined;
  const defaultDisplayName = providerSpec?.displayName || providerName || '';
  const currentDisplayName = (resolvedProviderConfig.displayName || '').trim();
  const effectiveDisplayName = currentDisplayName || defaultDisplayName;
  const currentEnabled = resolvedProviderConfig.enabled !== false;
  const providerTitle = providerDisplayName.trim() || effectiveDisplayName || providerName || t('providersSelectPlaceholder');
  const providerModelAliases = useMemo(
    () => normalizeModelList([providerSpec?.modelPrefix || providerName || '', providerName || '']),
    [providerName, providerSpec?.modelPrefix]
  );
  const defaultApiBase = providerSpec?.defaultApiBase || '';
  const currentApiBase = resolvedProviderConfig.apiBase || defaultApiBase;
  const currentHeaders = normalizeHeaders(resolvedProviderConfig.extraHeaders || null);
  const currentWireApi = (resolvedProviderConfig.wireApi || providerSpec?.defaultWireApi || 'auto') as WireApiType;
  const defaultModels = useMemo(
    () =>
      normalizeModelList(
        (providerSpec?.defaultModels ?? []).map((model) => toProviderLocalModelId(model, providerModelAliases))
      ),
    [providerSpec?.defaultModels, providerModelAliases]
  );
  const currentModels = useMemo(
    () =>
      normalizeModelList(
        (resolvedProviderConfig.models ?? []).map((model) => toProviderLocalModelId(model, providerModelAliases))
      ),
    [resolvedProviderConfig.models, providerModelAliases]
  );
  const currentEditableModels = useMemo(() => resolveEditableModels(defaultModels, currentModels), [defaultModels, currentModels]);
  const currentModelThinking = useMemo(
    () =>
      normalizeModelThinkingForModels(
        normalizeModelThinkingConfig(resolvedProviderConfig.modelThinking, providerModelAliases),
        currentEditableModels
      ),
    [currentEditableModels, providerModelAliases, resolvedProviderConfig.modelThinking]
  );
  const language = getLanguage();
  const apiBaseHelpText =
    providerSpec?.apiBaseHelp?.[language] || providerSpec?.apiBaseHelp?.en || apiBaseHint?.help || t('providerApiBaseHelp');
  const providerAuth = providerSpec?.auth;
  const providerAuthMethods = providerAuth?.methods ?? [];
  const supportsWireApi = Boolean(providerSpec?.supportsWireApi) || isCustomProvider;
  const providerAuthMethodOptions = useMemo(
    () =>
      providerAuthMethods.map((method) => ({
        value: method.id,
        label: method.label?.[language] || method.label?.en || method.id
      })),
    [providerAuthMethods, language]
  );
  const preferredAuthMethodId = useMemo(
    () => resolvePreferredAuthMethodId({ providerName, methods: providerAuthMethods, defaultMethodId: providerAuth?.defaultMethodId, language }),
    [providerName, providerAuth?.defaultMethodId, providerAuthMethods, language]
  );
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
  const selectedAuthMethod = useMemo(
    () => providerAuthMethods.find((method) => method.id === resolvedAuthMethodId),
    [providerAuthMethods, resolvedAuthMethodId]
  );
  const shouldUseAuthMethodPills = shouldUsePillSelector({
    required: providerAuth?.kind === 'device_code',
    hasDefault: Boolean(providerAuth?.defaultMethodId?.trim()),
    optionCount: providerAuthMethods.length
  });
  const wireApiSelectOptions: PillSelectOption[] = (providerSpec?.wireApiOptions || ['auto', 'chat', 'responses']).map((option) => ({
    value: option,
    label: option === 'chat' ? t('wireApiChat') : option === 'responses' ? t('wireApiResponses') : t('wireApiAuto')
  }));
  const shouldUseWireApiPills = shouldUsePillSelector({
    required: supportsWireApi,
    hasDefault: typeof providerSpec?.defaultWireApi === 'string' && providerSpec.defaultWireApi.length > 0,
    optionCount: wireApiSelectOptions.length
  });

  const clearAuthPollTimer = useCallback(() => {
    if (authPollTimerRef.current !== null) {
      window.clearTimeout(authPollTimerRef.current);
      authPollTimerRef.current = null;
    }
  }, []);

  const scheduleProviderAuthPoll = useCallback(
    (sessionId: string, delayMs: number) => {
      clearAuthPollTimer();
      authPollTimerRef.current = window.setTimeout(() => {
        void (async () => {
          if (!providerName) {
            return;
          }
          try {
            const result = await pollProviderAuth.mutateAsync({ provider: providerName, data: { sessionId } });
            if (result.status === 'pending') {
              setAuthStatusMessage(t('providerAuthWaitingBrowser'));
              scheduleProviderAuthPoll(sessionId, result.nextPollMs ?? delayMs);
              return;
            }
            if (result.status === 'authorized') {
              setAuthSessionId(null);
              clearAuthPollTimer();
              setAuthStatusMessage(t('providerAuthCompleted'));
              toast.success(t('providerAuthCompleted'));
              queryClient.invalidateQueries({ queryKey: ['config'] });
              queryClient.invalidateQueries({ queryKey: ['config-meta'] });
              return;
            }
            setAuthSessionId(null);
            clearAuthPollTimer();
            setAuthStatusMessage(result.message || `Authorization ${result.status}.`);
            toast.error(result.message || `Authorization ${result.status}.`);
          } catch (error) {
            setAuthSessionId(null);
            clearAuthPollTimer();
            const message = error instanceof Error ? error.message : String(error);
            setAuthStatusMessage(message);
            toast.error(`Authorization failed: ${message}`);
          }
        })();
      }, Math.max(1000, delayMs));
    },
    [clearAuthPollTimer, pollProviderAuth, providerName, queryClient]
  );

  useEffect(() => {
    if (!providerName) {
      setApiKey('');
      setEnabled(true);
      setApiBase('');
      setExtraHeaders(null);
      setWireApi('auto');
      setModels([]);
      setModelThinking({});
      setModelDraft('');
      setProviderDisplayName('');
      setAuthSessionId(null);
      setAuthStatusMessage('');
      setAuthMethodId('');
      clearAuthPollTimer();
      return;
    }

    setApiKey('');
    setEnabled(currentEnabled);
    setApiBase(currentApiBase);
    setExtraHeaders(resolvedProviderConfig.extraHeaders || null);
    setWireApi(currentWireApi);
    setModels(currentEditableModels);
    setModelThinking(currentModelThinking);
    setModelDraft('');
    setProviderDisplayName(effectiveDisplayName);
    setAuthSessionId(null);
    setAuthStatusMessage('');
    setAuthMethodId(preferredAuthMethodId);
    clearAuthPollTimer();
  }, [
    providerName,
    currentApiBase,
    currentEnabled,
    resolvedProviderConfig.extraHeaders,
    currentWireApi,
    currentEditableModels,
    currentModelThinking,
    effectiveDisplayName,
    preferredAuthMethodId,
    clearAuthPollTimer
  ]);

  useEffect(() => () => clearAuthPollTimer(), [clearAuthPollTimer]);
  useEffect(() => setModelThinking((prev) => normalizeModelThinkingForModels(prev, models)), [models]);

  const hasChanges = useMemo(() => {
    if (!providerName) {
      return false;
    }
    return (
      apiKey.trim().length > 0 ||
      enabled !== currentEnabled ||
      apiBase.trim() !== currentApiBase.trim() ||
      !headersEqual(extraHeaders, currentHeaders) ||
      (supportsWireApi && wireApi !== currentWireApi) ||
      !modelListsEqual(models, currentEditableModels) ||
      !modelThinkingEqual(modelThinking, currentModelThinking) ||
      (isCustomProvider && providerDisplayName.trim() !== effectiveDisplayName)
    );
  }, [
    providerName,
    apiKey,
    enabled,
    currentEnabled,
    apiBase,
    currentApiBase,
    extraHeaders,
    currentHeaders,
    supportsWireApi,
    wireApi,
    currentWireApi,
    models,
    currentEditableModels,
    modelThinking,
    currentModelThinking,
    isCustomProvider,
    providerDisplayName,
    effectiveDisplayName
  ]);

  const handleAddModel = () => {
    const next = toProviderLocalModelId(modelDraft, providerModelAliases);
    if (!next) {
      return;
    }
    if (models.includes(next)) {
      setModelDraft('');
      return;
    }
    setModels((prev) => [...prev, next]);
    setModelDraft('');
  };

  const toggleModelThinkingLevel = (modelName: string, level: ThinkingLevel) => {
    setModelThinking((prev) => {
      const currentEntry = prev[modelName];
      const currentLevels = currentEntry?.supported ?? [];
      const nextLevels = currentLevels.includes(level)
        ? currentLevels.filter((item) => item !== level)
        : THINKING_LEVELS.filter((item) => item === level || currentLevels.includes(item));
      if (nextLevels.length === 0) {
        const next = { ...prev };
        delete next[modelName];
        return next;
      }
      const nextDefault =
        currentEntry?.default && nextLevels.includes(currentEntry.default) ? currentEntry.default : undefined;
      return {
        ...prev,
        [modelName]: nextDefault ? { supported: nextLevels, default: nextDefault } : { supported: nextLevels }
      };
    });
  };

  const setModelThinkingDefault = (modelName: string, level: ThinkingLevel | null) => {
    setModelThinking((prev) => {
      const currentEntry = prev[modelName];
      if (!currentEntry || currentEntry.supported.length === 0) {
        return prev;
      }
      if (level && !currentEntry.supported.includes(level)) {
        return prev;
      }
      return {
        ...prev,
        [modelName]: level ? { supported: currentEntry.supported, default: level } : { supported: currentEntry.supported }
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerName) {
      return;
    }

    const payload: ProviderConfigUpdate = {};
    const trimmedApiKey = apiKey.trim();
    const trimmedApiBase = apiBase.trim();
    const normalizedHeaders = normalizeHeaders(extraHeaders);
    const trimmedDisplayName = providerDisplayName.trim();

    if (isCustomProvider && trimmedDisplayName !== effectiveDisplayName) {
      payload.displayName = trimmedDisplayName.length > 0 ? trimmedDisplayName : null;
    }
    if (trimmedApiKey.length > 0) {
      payload.apiKey = trimmedApiKey;
    }
    applyEnabledPatch(payload, enabled, currentEnabled);
    if (trimmedApiBase !== currentApiBase.trim()) {
      payload.apiBase = trimmedApiBase.length > 0 && trimmedApiBase !== defaultApiBase ? trimmedApiBase : null;
    }
    if (!headersEqual(normalizedHeaders, currentHeaders)) {
      payload.extraHeaders = normalizedHeaders;
    }
    if (supportsWireApi && wireApi !== currentWireApi) {
      payload.wireApi = wireApi;
    }
    if (!modelListsEqual(models, currentEditableModels)) {
      payload.models = serializeModelsForSave(models, defaultModels);
    }
    if (!modelThinkingEqual(modelThinking, currentModelThinking)) {
      payload.modelThinking = normalizeModelThinkingForModels(modelThinking, models);
    }

    updateProvider.mutate({ provider: providerName, data: payload });
  };

  const handleTestConnection = async () => {
    if (!providerName) {
      return;
    }
    const preferredModel = models.find((modelName) => modelName.trim().length > 0) ?? '';
    const testModel = toProviderLocalModelId(preferredModel, providerModelAliases);
    const payload: ProviderConnectionTestRequest = {
      apiBase: apiBase.trim(),
      extraHeaders: normalizeHeaders(extraHeaders),
      model: testModel || null
    };
    if (apiKey.trim().length > 0) {
      payload.apiKey = apiKey.trim();
    }
    if (supportsWireApi) {
      payload.wireApi = wireApi;
    }

    try {
      const result = await testProviderConnection.mutateAsync({ provider: providerName, data: payload });
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
    if (!providerName || !isCustomProvider) {
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

  const handleStartProviderAuth = async () => {
    if (!providerName || providerAuth?.kind !== 'device_code') {
      return;
    }

    try {
      setAuthStatusMessage('');
      const result = await startProviderAuth.mutateAsync({
        provider: providerName,
        data: resolvedAuthMethodId ? { methodId: resolvedAuthMethodId } : {}
      });
      if (!result.sessionId || !result.verificationUri) {
        throw new Error(t('providerAuthStartFailed'));
      }
      setAuthSessionId(result.sessionId);
      setAuthStatusMessage(`${t('providerAuthOpenPrompt')}${result.userCode}${t('providerAuthOpenPromptSuffix')}`);
      window.open(result.verificationUri, '_blank', 'noopener,noreferrer');
      scheduleProviderAuthPoll(result.sessionId, result.intervalMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAuthSessionId(null);
      clearAuthPollTimer();
      setAuthStatusMessage(message);
      toast.error(`${t('providerAuthStartFailed')}: ${message}`);
    }
  };

  const handleImportProviderAuthFromCli = async () => {
    if (!providerName || providerAuth?.kind !== 'device_code') {
      return;
    }
    try {
      clearAuthPollTimer();
      setAuthSessionId(null);
      const result = await importProviderAuthFromCli.mutateAsync({ provider: providerName });
      setAuthStatusMessage(`${t('providerAuthImportStatusPrefix')}${result.expiresAt ? ` (expires: ${result.expiresAt})` : ''}`);
      toast.success(t('providerAuthImportSuccess'));
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['config-meta'] });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAuthStatusMessage(message);
      toast.error(`${t('providerAuthImportFailed')}: ${message}`);
    }
  };

  if (!providerName || !providerSpec) {
    return (
      <ConfigSplitEmptyPane>
        <div>
          <h3 className='text-base font-semibold text-gray-900'>{t('providersSelectTitle')}</h3>
          <p className='mt-2 text-sm text-gray-500'>{t('providersSelectDescription')}</p>
        </div>
      </ConfigSplitEmptyPane>
    );
  }

  return (
    <ConfigSplitDetailPane>
      <ConfigSplitPaneHeader className='px-6 py-4'>
        <div className='flex items-center justify-between'>
          <h3 className='truncate text-lg font-semibold text-gray-900'>{providerTitle}</h3>
          <div className='flex items-center gap-3'>
            {isCustomProvider && (
              <button
                type='button'
                onClick={handleDeleteProvider}
                disabled={deleteProvider.isPending}
                className='text-gray-400 transition-colors hover:text-red-500'
                title={t('providerDelete')}
              >
                <Trash2 className='h-4 w-4' />
              </button>
            )}
            <ProviderStatusBadge enabled={currentEnabled} apiKeySet={resolvedProviderConfig.apiKeySet} />
          </div>
        </div>
      </ConfigSplitPaneHeader>

      <form onSubmit={handleSubmit} className='flex min-h-0 flex-1 flex-col'>
        <ConfigSplitPaneBody className='space-y-5 px-6 py-5'>
          <ProviderEnabledField enabled={enabled} onChange={setEnabled} />

          {isCustomProvider && (
            <div className='space-y-2'>
              <Label htmlFor='providerDisplayName' className='text-sm font-medium text-gray-900'>
                {t('providerDisplayName')}
              </Label>
              <Input
                id='providerDisplayName'
                type='text'
                value={providerDisplayName}
                onChange={(e) => setProviderDisplayName(e.target.value)}
                placeholder={defaultDisplayName || t('providerDisplayNamePlaceholder')}
                className='rounded-xl'
              />
              <p className='text-xs text-gray-500'>{t('providerDisplayNameHelpShort')}</p>
            </div>
          )}

          <div className='space-y-2'>
            <Label htmlFor='apiKey' className='text-sm font-medium text-gray-900'>
              {apiKeyHint?.label ?? t('apiKey')}
            </Label>
            <MaskedInput
              id='apiKey'
              value={apiKey}
              isSet={resolvedProviderConfig.apiKeySet}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={apiKeyHint?.placeholder ?? t('enterApiKey')}
              className='rounded-xl'
            />
            <p className='text-xs text-gray-500'>{t('leaveBlankToKeepUnchanged')}</p>
          </div>

          <ProviderAuthSection
            providerAuth={providerAuth}
            providerAuthNote={providerAuth?.note?.[language] || providerAuth?.note?.en || providerAuth?.displayName || ''}
            providerAuthMethodOptions={providerAuthMethodOptions}
            providerAuthMethodsCount={providerAuthMethods.length}
            selectedAuthMethodHint={selectedAuthMethod?.hint?.[language] || selectedAuthMethod?.hint?.en || ''}
            shouldUseAuthMethodPills={shouldUseAuthMethodPills}
            resolvedAuthMethodId={resolvedAuthMethodId}
            onAuthMethodChange={setAuthMethodId}
            onStartProviderAuth={handleStartProviderAuth}
            onImportProviderAuthFromCli={handleImportProviderAuthFromCli}
            startPending={startProviderAuth.isPending}
            importPending={importProviderAuthFromCli.isPending}
            authSessionId={authSessionId}
            authStatusMessage={authStatusMessage}
          />

          <div className='space-y-2'>
            <Label htmlFor='apiBase' className='text-sm font-medium text-gray-900'>
              {apiBaseHint?.label ?? t('apiBase')}
            </Label>
            <Input
              id='apiBase'
              type='text'
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder={defaultApiBase || apiBaseHint?.placeholder || 'https://api.example.com'}
              className='rounded-xl'
            />
            <p className='text-xs text-gray-500'>{apiBaseHelpText}</p>
          </div>

          <ProviderModelsSection
            models={models}
            modelThinking={modelThinking}
            modelDraft={modelDraft}
            showModelInput={showModelInput}
            onModelDraftChange={setModelDraft}
            onShowModelInputChange={setShowModelInput}
            onAddModel={handleAddModel}
            onRemoveModel={(modelName) => {
              setModels((prev) => prev.filter((name) => name !== modelName));
              setModelThinking((prev) => {
                const next = { ...prev };
                delete next[modelName];
                return next;
              });
            }}
            onToggleModelThinkingLevel={toggleModelThinkingLevel}
            onSetModelThinkingDefault={setModelThinkingDefault}
            thinkingLevels={THINKING_LEVELS}
            formatThinkingLevelLabel={formatThinkingLevelLabel}
          />

          <ProviderAdvancedSettingsSection
            showAdvanced={showAdvanced}
            onShowAdvancedChange={setShowAdvanced}
            supportsWireApi={supportsWireApi}
            wireApiLabel={wireApiHint?.label ?? t('wireApi')}
            wireApi={wireApi}
            onWireApiChange={setWireApi}
            shouldUseWireApiPills={shouldUseWireApiPills}
            wireApiSelectOptions={wireApiSelectOptions}
            extraHeadersLabel={extraHeadersHint?.label ?? t('extraHeaders')}
            extraHeaders={extraHeaders}
            onExtraHeadersChange={setExtraHeaders}
          />
        </ConfigSplitPaneBody>

        <ConfigSplitPaneFooter className='flex items-center justify-between px-6 py-4'>
          <Button type='button' variant='outline' size='sm' onClick={handleTestConnection} disabled={testProviderConnection.isPending}>
            <CircleDotDashed className='mr-1.5 h-4 w-4' />
            {testProviderConnection.isPending ? t('providerTestingConnection') : t('providerTestConnection')}
          </Button>
          <Button type='submit' disabled={updateProvider.isPending || !hasChanges}>
            {updateProvider.isPending ? t('saving') : hasChanges ? t('save') : t('unchanged')}
          </Button>
        </ConfigSplitPaneFooter>
      </form>
    </ConfigSplitDetailPane>
  );
}
