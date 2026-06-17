import { hintForPath } from '@/shared/lib/config-hints';
import { t } from '@/shared/lib/i18n';
import type { getLanguage } from '@/shared/lib/i18n';
import type {
  ConfigSchemaResponse,
  ProviderTemplateView,
  ProviderTemplatesView,
  ProvidersView
} from '@/shared/lib/api';
import {
  EMPTY_PROVIDER_CONFIG,
  mergeModelConfig,
  normalizeHeaders,
  normalizeModelConfigForModels,
  normalizeModelList,
  resolveEditableModels,
  resolvePreferredAuthMethodId,
  shouldUsePillSelector,
  toProviderLocalModelId,
  type WireApiType
} from './provider-form-support.utils';

type ProviderFormContextInput = {
  providerName?: string;
  providersView?: ProvidersView;
  templatesView?: ProviderTemplatesView;
  schema?: ConfigSchemaResponse;
  language: ReturnType<typeof getLanguage>;
};
type ProviderFormAuthContextInput = {
  providerName?: string;
  providerSpec?: ProviderTemplateView;
  language: ReturnType<typeof getLanguage>;
};

function resolveProviderFormAuthContext(input: ProviderFormAuthContextInput) {
  const { providerName, providerSpec, language } = input;
  const providerAuth = providerSpec?.auth;
  const providerAuthMethods = providerAuth?.methods ?? [];
  const providerAuthMethodOptions = providerAuthMethods.map((method) => ({
    value: method.id,
    label: method.label?.[language] || method.label?.en || method.id
  }));
  const preferredAuthMethodId = resolvePreferredAuthMethodId({
    providerName: providerSpec?.providerType ?? providerName,
    methods: providerAuthMethods,
    defaultMethodId: providerAuth?.defaultMethodId,
    language
  });
  const shouldUseAuthMethodPills = shouldUsePillSelector({
    required: providerAuth?.kind === 'device_code',
    hasDefault: Boolean(providerAuth?.defaultMethodId?.trim()),
    optionCount: providerAuthMethods.length
  });

  return { providerAuth, providerAuthMethodOptions, providerAuthMethods, preferredAuthMethodId, shouldUseAuthMethodPills };
}

function resolveProviderWireApiContext(providerSpec: ProviderTemplateView | undefined, isCustomProvider: boolean) {
  const supportsWireApi = Boolean(providerSpec?.supportsWireApi) || isCustomProvider;
  const wireApiSelectOptions = (providerSpec?.wireApiOptions || ['auto', 'chat', 'responses']).map((option) => ({
    value: option,
    label: option === 'chat' ? t('wireApiChat') : option === 'responses' ? t('wireApiResponses') : t('wireApiAuto')
  }));
  const shouldUseWireApiPills = shouldUsePillSelector({
    required: supportsWireApi,
    hasDefault: typeof providerSpec?.defaultWireApi === 'string' && providerSpec.defaultWireApi.length > 0,
    optionCount: wireApiSelectOptions.length
  });

  return { shouldUseWireApiPills, supportsWireApi, wireApiSelectOptions };
}

export function resolveProviderFormContext(input: ProviderFormContextInput) {
  const { providerName, providersView, templatesView, schema, language } = input;
  const providerConfig = providerName ? providersView?.providers[providerName] : null;
  const providerSpec = templatesView?.providerTemplates.find((template) => template.providerType === providerConfig?.providerType);
  const resolvedProviderConfig = providerConfig ?? EMPTY_PROVIDER_CONFIG;
  const uiHints = schema?.uiHints;
  const isCustomProvider = Boolean(providerConfig?.isCustom);
  const apiKeyHint = providerName ? hintForPath(`providers.${providerName}.apiKey`, uiHints) : undefined;
  const apiBaseHint = providerName ? hintForPath(`providers.${providerName}.apiBase`, uiHints) : undefined;
  const extraHeadersHint = providerName ? hintForPath(`providers.${providerName}.extraHeaders`, uiHints) : undefined;
  const wireApiHint = providerName ? hintForPath(`providers.${providerName}.wireApi`, uiHints) : undefined;
  const defaultDisplayName = providerSpec?.displayName || providerConfig?.displayName || providerName || '';
  const currentDisplayName = (resolvedProviderConfig.displayName || '').trim();
  const effectiveDisplayName = currentDisplayName || defaultDisplayName;
  const currentEnabled = resolvedProviderConfig.enabled !== false;
  const providerModelAliases = normalizeModelList([providerSpec?.modelPrefix || providerSpec?.providerType || '', providerName || '']);
  const defaultApiBase = providerSpec?.defaultApiBase || '';
  const currentApiBase = resolvedProviderConfig.apiBase || defaultApiBase;
  const currentHeaders = normalizeHeaders(resolvedProviderConfig.extraHeaders || null);
  const currentWireApi = (resolvedProviderConfig.wireApi || providerSpec?.defaultWireApi || 'auto') as WireApiType;
  const defaultModels = normalizeModelList(
    (providerSpec?.defaultModels ?? []).map((model) => toProviderLocalModelId(model, providerModelAliases))
  );
  const currentModels = normalizeModelList(
    (resolvedProviderConfig.models ?? []).map((model) => toProviderLocalModelId(model, providerModelAliases))
  );
  const currentEditableModels = resolveEditableModels(defaultModels, currentModels);
  const currentModelConfig = normalizeModelConfigForModels(
    mergeModelConfig(providerSpec?.modelConfig, resolvedProviderConfig.modelConfig, providerModelAliases),
    currentEditableModels
  );
  const apiBaseHelpText =
    providerSpec?.apiBaseHelp?.[language] || providerSpec?.apiBaseHelp?.en || apiBaseHint?.help || t('providerApiBaseHelp');
  const authContext = resolveProviderFormAuthContext({ providerName, providerSpec, language });
  const wireApiContext = resolveProviderWireApiContext(providerSpec, isCustomProvider);

  return {
    apiBaseHelpText,
    apiBaseHint,
    apiKeyHint,
    currentApiBase,
    currentEditableModels,
    currentEnabled,
    currentHeaders,
    currentModelConfig,
    currentWireApi,
    defaultApiBase,
    defaultDisplayName,
    effectiveDisplayName,
    extraHeadersHint,
    ...authContext,
    providerConfig,
    providerModelAliases,
    resolvedProviderConfig,
    wireApiHint,
    ...wireApiContext
  };
}
