import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
} from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MaskedInput } from '@/components/common/MaskedInput';
import { KeyValueEditor } from '@/components/common/KeyValueEditor';
import { StatusDot } from '@/components/ui/status-dot';
import { getLanguage, t } from '@/lib/i18n';
import { hintForPath } from '@/lib/config-hints';
import type { ProviderConfigView, ProviderConfigUpdate, ProviderConnectionTestRequest } from '@/api/types';
import { CircleDotDashed, Plus, X, Trash2, ChevronDown, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { CONFIG_DETAIL_CARD_CLASS, CONFIG_EMPTY_DETAIL_CARD_CLASS } from './config-layout';

type WireApiType = 'auto' | 'chat' | 'responses';

type ProviderFormProps = {
  providerName?: string;
  onProviderDeleted?: (providerName: string) => void;
};

type ProviderAuthMethodOption = {
  id: string;
};

type PillSelectOption = {
  value: string;
  label: string;
};

const EMPTY_PROVIDER_CONFIG: ProviderConfigView = {
  displayName: '',
  apiKeySet: false,
  apiKeyMasked: undefined,
  apiBase: null,
  extraHeaders: null,
  wireApi: null,
  models: []
};

function normalizeHeaders(input: Record<string, string> | null | undefined): Record<string, string> | null {
  if (!input) {
    return null;
  }
  const entries = Object.entries(input)
    .map(([key, value]) => [key.trim(), value] as const)
    .filter(([key]) => key.length > 0);
  if (entries.length === 0) {
    return null;
  }
  return Object.fromEntries(entries);
}

function headersEqual(
  left: Record<string, string> | null | undefined,
  right: Record<string, string> | null | undefined
): boolean {
  const a = normalizeHeaders(left);
  const b = normalizeHeaders(right);
  if (a === null && b === null) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  const aEntries = Object.entries(a).sort(([ak], [bk]) => ak.localeCompare(bk));
  const bEntries = Object.entries(b).sort(([ak], [bk]) => ak.localeCompare(bk));
  if (aEntries.length !== bEntries.length) {
    return false;
  }
  return aEntries.every(([key, value], index) => key === bEntries[index][0] && value === bEntries[index][1]);
}

function normalizeModelList(input: string[] | null | undefined): string[] {
  if (!input || input.length === 0) {
    return [];
  }
  const deduped = new Set<string>();
  for (const item of input) {
    const trimmed = item.trim();
    if (trimmed) {
      deduped.add(trimmed);
    }
  }
  return [...deduped];
}

function stripProviderPrefix(model: string, prefix: string): string {
  const trimmed = model.trim();
  if (!trimmed || !prefix.trim()) {
    return trimmed;
  }
  const fullPrefix = `${prefix.trim()}/`;
  if (trimmed.startsWith(fullPrefix)) {
    return trimmed.slice(fullPrefix.length);
  }
  return trimmed;
}

function toProviderLocalModelId(model: string, aliases: string[]): string {
  let normalized = model.trim();
  if (!normalized) {
    return '';
  }
  for (const alias of aliases) {
    const cleanAlias = alias.trim();
    if (!cleanAlias) {
      continue;
    }
    normalized = stripProviderPrefix(normalized, cleanAlias);
  }
  return normalized.trim();
}

function modelListsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item === right[index]);
}

function mergeModelLists(base: string[], extra: string[]): string[] {
  const merged = [...base];
  for (const item of extra) {
    if (!merged.includes(item)) {
      merged.push(item);
    }
  }
  return merged;
}

function resolveEditableModels(defaultModels: string[], savedModels: string[]): string[] {
  if (savedModels.length === 0) {
    return defaultModels;
  }
  const looksLikeLegacyCustomList = savedModels.every((model) => !defaultModels.includes(model));
  if (looksLikeLegacyCustomList) {
    return mergeModelLists(defaultModels, savedModels);
  }
  return savedModels;
}

function serializeModelsForSave(models: string[], defaultModels: string[]): string[] {
  if (modelListsEqual(models, defaultModels)) {
    return [];
  }
  return models;
}

function resolvePreferredAuthMethodId(params: {
  providerName?: string;
  methods: ProviderAuthMethodOption[];
  defaultMethodId?: string;
  language: 'zh' | 'en';
}): string {
  const { providerName, methods, defaultMethodId, language } = params;
  if (methods.length === 0) {
    return '';
  }

  const methodIdMap = new Map<string, string>();
  for (const method of methods) {
    const methodId = method.id.trim();
    if (methodId) {
      methodIdMap.set(methodId.toLowerCase(), methodId);
    }
  }

  const pick = (...candidates: string[]): string | undefined => {
    for (const candidate of candidates) {
      const resolved = methodIdMap.get(candidate.toLowerCase());
      if (resolved) {
        return resolved;
      }
    }
    return undefined;
  };

  const normalizedDefault = defaultMethodId?.trim();
  if (providerName === 'minimax-portal') {
    if (language === 'zh') {
      return pick('cn', 'china-mainland') ?? pick(normalizedDefault ?? '') ?? methods[0]?.id ?? '';
    }
    if (language === 'en') {
      return pick('global', 'intl', 'international') ?? pick(normalizedDefault ?? '') ?? methods[0]?.id ?? '';
    }
  }

  if (normalizedDefault) {
    const matchedDefault = pick(normalizedDefault);
    if (matchedDefault) {
      return matchedDefault;
    }
  }

  if (language === 'zh') {
    return pick('cn') ?? methods[0]?.id ?? '';
  }
  if (language === 'en') {
    return pick('global') ?? methods[0]?.id ?? '';
  }

  return methods[0]?.id ?? '';
}

function shouldUsePillSelector(params: {
  required: boolean;
  hasDefault: boolean;
  optionCount: number;
}): boolean {
  return params.required && params.hasDefault && params.optionCount > 1 && params.optionCount <= 3;
}

function PillSelector(props: {
  value: string;
  onChange: (value: string) => void;
  options: PillSelectOption[];
}) {
  const { value, onChange, options } = props;

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              selected
                ? 'border-primary bg-primary text-white shadow-sm'
                : 'border-gray-200 bg-white text-gray-700 hover:border-primary/40 hover:text-primary'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

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
  const [apiBase, setApiBase] = useState('');
  const [extraHeaders, setExtraHeaders] = useState<Record<string, string> | null>(null);
  const [wireApi, setWireApi] = useState<WireApiType>('auto');
  const [models, setModels] = useState<string[]>([]);
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

  const providerTitle = providerDisplayName.trim() || effectiveDisplayName || providerName || t('providersSelectPlaceholder');
  const providerModelPrefix = providerSpec?.modelPrefix || providerName || '';
  const providerModelAliases = useMemo(
    () => normalizeModelList([providerModelPrefix, providerName || '']),
    [providerModelPrefix, providerName]
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
  const currentEditableModels = useMemo(
    () => resolveEditableModels(defaultModels, currentModels),
    [defaultModels, currentModels]
  );
  const language = getLanguage();
  const apiBaseHelpText =
    providerSpec?.apiBaseHelp?.[language] ||
    providerSpec?.apiBaseHelp?.en ||
    apiBaseHint?.help ||
    t('providerApiBaseHelp');
  const providerAuth = providerSpec?.auth;
  const providerAuthMethods = useMemo(
    () => providerAuth?.methods ?? [],
    [providerAuth?.methods]
  );
  const providerAuthMethodOptions = useMemo(
    () =>
      providerAuthMethods.map((method) => ({
        value: method.id,
        label: method.label?.[language] || method.label?.en || method.id
      })),
    [providerAuthMethods, language]
  );
  const preferredAuthMethodId = useMemo(
    () => resolvePreferredAuthMethodId({
      providerName,
      methods: providerAuthMethods,
      defaultMethodId: providerAuth?.defaultMethodId,
      language
    }),
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
  const selectedAuthMethodHint =
    selectedAuthMethod?.hint?.[language] || selectedAuthMethod?.hint?.en || '';
  const shouldUseAuthMethodPills = shouldUsePillSelector({
    required: providerAuth?.kind === 'device_code',
    hasDefault: Boolean(providerAuth?.defaultMethodId?.trim()),
    optionCount: providerAuthMethods.length
  });
  const providerAuthNote =
    providerAuth?.note?.[language] ||
    providerAuth?.note?.en ||
    providerAuth?.displayName ||
    '';
  const wireApiOptions = providerSpec?.wireApiOptions || ['auto', 'chat', 'responses'];
  const wireApiSelectOptions: PillSelectOption[] = wireApiOptions.map((option) => ({
    value: option,
    label: option === 'chat' ? t('wireApiChat') : option === 'responses' ? t('wireApiResponses') : t('wireApiAuto')
  }));
  const shouldUseWireApiPills = shouldUsePillSelector({
    required: Boolean(providerSpec?.supportsWireApi),
    hasDefault: typeof providerSpec?.defaultWireApi === 'string' && providerSpec.defaultWireApi.length > 0,
    optionCount: wireApiSelectOptions.length
  });

  const clearAuthPollTimer = useCallback(() => {
    if (authPollTimerRef.current !== null) {
      window.clearTimeout(authPollTimerRef.current);
      authPollTimerRef.current = null;
    }
  }, []);

  const scheduleProviderAuthPoll = useCallback((sessionId: string, delayMs: number) => {
    clearAuthPollTimer();
    authPollTimerRef.current = window.setTimeout(() => {
      void (async () => {
        if (!providerName) {
          return;
        }
        try {
          const result = await pollProviderAuth.mutateAsync({
            provider: providerName,
            data: { sessionId }
          });
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
  }, [clearAuthPollTimer, pollProviderAuth, providerName, queryClient]);

  useEffect(() => {
    if (!providerName) {
      setApiKey('');
      setApiBase('');
      setExtraHeaders(null);
      setWireApi('auto');
      setModels([]);
      setModelDraft('');
      setProviderDisplayName('');
      setAuthSessionId(null);
      setAuthStatusMessage('');
      setAuthMethodId('');
      clearAuthPollTimer();
      return;
    }

    setApiKey('');
    setApiBase(currentApiBase);
    setExtraHeaders(resolvedProviderConfig.extraHeaders || null);
    setWireApi(currentWireApi);
    setModels(currentEditableModels);
    setModelDraft('');
    setProviderDisplayName(effectiveDisplayName);
    setAuthSessionId(null);
    setAuthStatusMessage('');
    setAuthMethodId(preferredAuthMethodId);
    clearAuthPollTimer();
  }, [
    providerName,
    currentApiBase,
    resolvedProviderConfig.extraHeaders,
    currentWireApi,
    currentEditableModels,
    effectiveDisplayName,
    preferredAuthMethodId,
    clearAuthPollTimer
  ]);

  useEffect(() => () => clearAuthPollTimer(), [clearAuthPollTimer]);

  const hasChanges = useMemo(() => {
    if (!providerName) {
      return false;
    }
    const apiKeyChanged = apiKey.trim().length > 0;
    const apiBaseChanged = apiBase.trim() !== currentApiBase.trim();
    const headersChanged = !headersEqual(extraHeaders, currentHeaders);
    const wireApiChanged = providerSpec?.supportsWireApi ? wireApi !== currentWireApi : false;
    const modelsChanged = !modelListsEqual(models, currentEditableModels);
    const displayNameChanged = isCustomProvider
      ? providerDisplayName.trim() !== effectiveDisplayName
      : false;

    return apiKeyChanged || apiBaseChanged || headersChanged || wireApiChanged || modelsChanged || displayNameChanged;
  }, [
    providerName,
    isCustomProvider,
    providerDisplayName,
    effectiveDisplayName,
    apiKey,
    apiBase,
    currentApiBase,
    extraHeaders,
    currentHeaders,
    providerSpec?.supportsWireApi,
    wireApi,
    currentWireApi,
    models,
    currentEditableModels
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

    if (trimmedApiBase !== currentApiBase.trim()) {
      payload.apiBase = trimmedApiBase.length > 0 && trimmedApiBase !== defaultApiBase ? trimmedApiBase : null;
    }

    if (!headersEqual(normalizedHeaders, currentHeaders)) {
      payload.extraHeaders = normalizedHeaders;
    }

    if (providerSpec?.supportsWireApi && wireApi !== currentWireApi) {
      payload.wireApi = wireApi;
    }
    if (!modelListsEqual(models, currentEditableModels)) {
      payload.models = serializeModelsForSave(models, defaultModels);
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
    if (providerSpec?.supportsWireApi) {
      payload.wireApi = wireApi;
    }

    try {
      const result = await testProviderConnection.mutateAsync({
        provider: providerName,
        data: payload
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
    if (!providerName || !isCustomProvider) {
      return;
    }
    const confirmed = window.confirm(t('providerDeleteConfirm'));
    if (!confirmed) {
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
      const expiresText = result.expiresAt ? ` (expires: ${result.expiresAt})` : '';
      setAuthStatusMessage(`${t('providerAuthImportStatusPrefix')}${expiresText}`);
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
      <div className={CONFIG_EMPTY_DETAIL_CARD_CLASS}>
        <div>
          <h3 className="text-base font-semibold text-gray-900">{t('providersSelectTitle')}</h3>
          <p className="mt-2 text-sm text-gray-500">{t('providersSelectDescription')}</p>
        </div>
      </div>
    );
  }

  const statusLabel = resolvedProviderConfig.apiKeySet ? t('statusReady') : t('statusSetup');

  return (
    <div className={CONFIG_DETAIL_CARD_CLASS}>
      <div className="border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="truncate text-lg font-semibold text-gray-900">{providerTitle}</h3>
          <div className="flex items-center gap-3">
            {isCustomProvider && (
              <button
                type="button"
                onClick={handleDeleteProvider}
                disabled={deleteProvider.isPending}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title={t('providerDelete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <StatusDot status={resolvedProviderConfig.apiKeySet ? 'ready' : 'setup'} label={statusLabel} />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {isCustomProvider && (
            <div className="space-y-2">
              <Label htmlFor="providerDisplayName" className="text-sm font-medium text-gray-900">
                {t('providerDisplayName')}
              </Label>
              <Input
                id="providerDisplayName"
                type="text"
                value={providerDisplayName}
                onChange={(e) => setProviderDisplayName(e.target.value)}
                placeholder={defaultDisplayName || t('providerDisplayNamePlaceholder')}
                className="rounded-xl"
              />
              <p className="text-xs text-gray-500">{t('providerDisplayNameHelpShort')}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="apiKey" className="text-sm font-medium text-gray-900">
              {apiKeyHint?.label ?? t('apiKey')}
            </Label>
            <MaskedInput
              id="apiKey"
              value={apiKey}
              isSet={resolvedProviderConfig.apiKeySet}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={apiKeyHint?.placeholder ?? t('enterApiKey')}
              className="rounded-xl"
            />
            <p className="text-xs text-gray-500">{t('leaveBlankToKeepUnchanged')}</p>
          </div>

          {providerAuth?.kind === 'device_code' && (
            <div className="space-y-2 rounded-xl border border-primary/20 bg-primary-50/50 p-3">
              <Label className="text-sm font-medium text-gray-900">
                {providerAuth.displayName || t('providerAuthSectionTitle')}
              </Label>
              {providerAuthNote ? (
                <p className="text-xs text-gray-600">{providerAuthNote}</p>
              ) : null}
              {providerAuthMethods.length > 1 ? (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">{t('providerAuthMethodLabel')}</Label>
                  {shouldUseAuthMethodPills ? (
                    <PillSelector
                      value={resolvedAuthMethodId}
                      onChange={setAuthMethodId}
                      options={providerAuthMethodOptions}
                    />
                  ) : (
                    <Select value={resolvedAuthMethodId} onValueChange={setAuthMethodId}>
                      <SelectTrigger className="h-8 rounded-lg bg-white">
                        <SelectValue placeholder={t('providerAuthMethodPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {providerAuthMethodOptions.map((method) => (
                          <SelectItem key={method.value} value={method.value}>
                            {method.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {selectedAuthMethodHint ? (
                    <p className="text-xs text-gray-500">{selectedAuthMethodHint}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleStartProviderAuth}
                  disabled={startProviderAuth.isPending || Boolean(authSessionId)}
                >
                  {startProviderAuth.isPending
                    ? t('providerAuthStarting')
                    : authSessionId
                      ? t('providerAuthAuthorizing')
                      : t('providerAuthAuthorizeInBrowser')}
                </Button>
                {providerAuth.supportsCliImport ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleImportProviderAuthFromCli}
                    disabled={importProviderAuthFromCli.isPending}
                  >
                    {importProviderAuthFromCli.isPending ? t('providerAuthImporting') : t('providerAuthImportFromCli')}
                  </Button>
                ) : null}
                {authSessionId ? (
                  <span className="text-xs text-gray-500">{t('providerAuthSessionLabel')}: {authSessionId.slice(0, 8)}…</span>
                ) : null}
              </div>
              {authStatusMessage ? (
                <p className="text-xs text-gray-600">{authStatusMessage}</p>
              ) : null}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="apiBase" className="text-sm font-medium text-gray-900">
              {apiBaseHint?.label ?? t('apiBase')}
            </Label>
            <Input
              id="apiBase"
              type="text"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder={defaultApiBase || apiBaseHint?.placeholder || 'https://api.example.com'}
              className="rounded-xl"
            />
            <p className="text-xs text-gray-500">{apiBaseHelpText}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-900">
                {t('providerModelsTitle')}
              </Label>
              {!showModelInput && (
                <button
                  type="button"
                  onClick={() => setShowModelInput(true)}
                  className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  {t('providerAddModel')}
                </button>
              )}
            </div>

            {showModelInput && (
              <div className="flex items-center gap-2">
                <Input
                  value={modelDraft}
                  onChange={(event) => setModelDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddModel();
                    }
                    if (event.key === 'Escape') {
                      setShowModelInput(false);
                      setModelDraft('');
                    }
                  }}
                  placeholder={t('providerModelInputPlaceholder')}
                  className="flex-1 rounded-xl"
                  autoFocus
                />
                <Button type="button" size="sm" onClick={handleAddModel} disabled={modelDraft.trim().length === 0}>
                  {t('add')}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setShowModelInput(false); setModelDraft(''); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {models.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
                <p className="text-sm text-gray-500">{t('providerModelsEmptyShort')}</p>
                {!showModelInput && (
                  <button
                    type="button"
                    onClick={() => setShowModelInput(true)}
                    className="mt-2 text-sm text-primary hover:text-primary/80 font-medium"
                  >
                    {t('providerAddFirstModel')}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {models.map((modelName) => (
                  <div
                    key={modelName}
                    className="group inline-flex max-w-full items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5"
                  >
                    <span className="max-w-[180px] truncate text-sm text-gray-800 sm:max-w-[240px]">{modelName}</span>
                    <button
                      type="button"
                      onClick={() => setModels((prev) => prev.filter((name) => name !== modelName))}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition-opacity hover:bg-gray-100 hover:text-gray-600 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                      aria-label={t('remove')}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Advanced Settings - Collapsible */}
          <div className="border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Settings2 className="h-3.5 w-3.5" />
                {t('providerAdvancedSettings')}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-5">
                {providerSpec.supportsWireApi && (
                  <div className="space-y-2">
                    <Label htmlFor="wireApi" className="text-sm font-medium text-gray-900">
                      {wireApiHint?.label ?? t('wireApi')}
                    </Label>
                    {shouldUseWireApiPills ? (
                      <PillSelector
                        value={wireApi}
                        onChange={(v) => setWireApi(v as WireApiType)}
                        options={wireApiSelectOptions}
                      />
                    ) : (
                      <Select value={wireApi} onValueChange={(v) => setWireApi(v as WireApiType)}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {wireApiSelectOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-900">
                    {extraHeadersHint?.label ?? t('extraHeaders')}
                  </Label>
                  <KeyValueEditor value={extraHeaders} onChange={setExtraHeaders} />
                  <p className="text-xs text-gray-500">{t('providerExtraHeadersHelpShort')}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <Button type="button" variant="outline" size="sm" onClick={handleTestConnection} disabled={testProviderConnection.isPending}>
            <CircleDotDashed className="mr-1.5 h-4 w-4" />
            {testProviderConnection.isPending ? t('providerTestingConnection') : t('providerTestConnection')}
          </Button>
          <Button type="submit" disabled={updateProvider.isPending || !hasChanges}>
            {updateProvider.isPending ? t('saving') : hasChanges ? t('save') : t('unchanged')}
          </Button>
        </div>
      </form>
    </div>
  );
}
