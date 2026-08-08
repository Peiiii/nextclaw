import { useMemo, useState } from "react";
import {
  useConfigSchema,
  useDeleteProvider,
  useProviders,
  useProviderTemplates,
  useUpdateProvider,
} from "@/shared/hooks/use-config";
import { getLanguage, t } from "@/shared/lib/i18n";
import type { ThinkingLevel } from "@/shared/lib/api";
import { ConfigSplitEmptyPane } from "@/shared/components/config-split-page";
import {
  buildProviderSavePayload,
  hasProviderFormChanges,
  normalizeModelConfigForModels,
  type ModelConfig,
  type WireApiType,
} from "@/features/settings/utils/provider-form-support.utils";
import {
  addProviderLocalModel,
  removeProviderLocalModel,
  setModelThinkingDefaultInConfig,
  setModelVisionInConfig,
  toggleModelThinkingLevelInConfig,
} from "@/features/settings/utils/provider-form-model.utils";
import { resolveProviderFormContext } from "@/features/settings/utils/provider-form-context.utils";
import { useProviderAuthFlow } from "@/features/settings/hooks/use-provider-auth-flow";
import { useProviderConnectivity } from "@/features/settings/hooks/use-provider-connectivity";
import { ProviderFormDetailPane } from "./provider-form-detail-pane";
type ProviderFormProps = {
  providerName?: string;
  onProviderDeleted?: (providerName: string) => void;
};
type ProviderFormContext = ReturnType<typeof resolveProviderFormContext>;
type ProviderFormEditorProps = {
  providerName: string;
  onProviderDeleted?: (providerName: string) => void;
  context: ProviderFormContext;
  language: ReturnType<typeof getLanguage>;
};

export function ProviderForm({
  providerName,
  onProviderDeleted,
}: ProviderFormProps) {
  const { data: providersView } = useProviders();
  const { data: templatesView } = useProviderTemplates();
  const { data: schema } = useConfigSchema();
  const language = getLanguage();
  const providerFormContext = useMemo(
    () =>
      resolveProviderFormContext({
        providerName,
        providersView,
        templatesView,
        schema,
        language,
      }),
    [language, providerName, providersView, schema, templatesView],
  );

  if (!providerName || !providerFormContext.providerConfig) {
    return (
      <ConfigSplitEmptyPane>
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {t("providersSelectTitle")}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("providersSelectDescription")}
          </p>
        </div>
      </ConfigSplitEmptyPane>
    );
  }

  const editorRevision = JSON.stringify({
    providerConfig: providerFormContext.providerConfig,
    currentApiBase: providerFormContext.currentApiBase,
    currentEditableModels: providerFormContext.currentEditableModels,
    currentModelConfig: providerFormContext.currentModelConfig,
    currentWireApi: providerFormContext.currentWireApi,
    effectiveDisplayName: providerFormContext.effectiveDisplayName,
    preferredAuthMethodId: providerFormContext.preferredAuthMethodId,
  });
  return (
    <ProviderFormEditor
      key={editorRevision}
      providerName={providerName}
      onProviderDeleted={onProviderDeleted}
      context={providerFormContext}
      language={language}
    />
  );
}

function ProviderFormEditor({
  providerName,
  onProviderDeleted,
  context: providerFormContext,
  language,
}: ProviderFormEditorProps) {
  const updateProvider = useUpdateProvider();
  const deleteProvider = useDeleteProvider();
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
    providerModelAliases,
    resolvedProviderConfig,
    preferredAuthMethodId,
    supportsWireApi,
  } = providerFormContext;
  const [apiKey, setApiKey] = useState("");
  const [apiBase, setApiBase] = useState(currentApiBase);
  const [extraHeaders, setExtraHeaders] = useState<Record<
    string,
    string
  > | null>(resolvedProviderConfig.extraHeaders || null);
  const [wireApi, setWireApi] = useState<WireApiType>(currentWireApi);
  const [models, setModels] = useState<string[]>(currentEditableModels);
  const [modelConfig, setModelConfig] =
    useState<ModelConfig>(currentModelConfig);
  const [modelDraft, setModelDraft] = useState("");
  const [providerDisplayName, setProviderDisplayName] =
    useState(effectiveDisplayName);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showModelInput, setShowModelInput] = useState(false);
  const [authMethodId, setAuthMethodId] = useState(preferredAuthMethodId);
  const connectivity = useProviderConnectivity({
    providerName,
    apiKey,
    apiKeyRequired: resolvedProviderConfig.apiKeyRequired !== false,
    apiKeySet: resolvedProviderConfig.apiKeySet,
    apiBase,
    extraHeaders,
    supportsWireApi,
    wireApi,
    models,
    providerModelAliases,
  });
  const providerTitle =
    providerDisplayName.trim() ||
    effectiveDisplayName ||
    providerName ||
    t("providersSelectPlaceholder");
  const resolvedAuthMethodId = useMemo(() => {
    if (!providerAuthMethods.length) {
      return "";
    }
    const normalizedCurrent = authMethodId.trim();
    if (
      normalizedCurrent &&
      providerAuthMethods.some((method) => method.id === normalizedCurrent)
    ) {
      return normalizedCurrent;
    }
    return preferredAuthMethodId || providerAuthMethods[0]?.id || "";
  }, [authMethodId, preferredAuthMethodId, providerAuthMethods]);
  const {
    authSessionId,
    authStatusMessage,
    importAuthFromCli,
    importPending,
    startAuth,
    startPending,
  } = useProviderAuthFlow({ providerName, providerAuth, resolvedAuthMethodId });

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
      effectiveDisplayName,
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
    effectiveDisplayName,
  ]);

  const handleModelsChange = (nextModels: string[]) => {
    setModels(nextModels);
    setModelConfig((current) =>
      normalizeModelConfigForModels(current, nextModels),
    );
  };

  const handleAddModel = () => {
    const result = addProviderLocalModel(
      models,
      modelDraft,
      providerModelAliases,
    );
    handleModelsChange(result.models);
    setModelDraft(result.draft);
  };

  const toggleModelThinkingLevel = (
    modelName: string,
    level: ThinkingLevel,
  ) => {
    setModelConfig((prev) =>
      toggleModelThinkingLevelInConfig(prev, modelName, level),
    );
  };

  const setModelThinkingDefault = (
    modelName: string,
    level: ThinkingLevel | null,
  ) => {
    setModelConfig((prev) =>
      setModelThinkingDefaultInConfig(prev, modelName, level),
    );
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
        effectiveDisplayName,
      }),
    });
  };

  const handleDeleteProvider = async () => {
    if (!providerName) {
      return;
    }
    if (!window.confirm(t("providerDeleteConfirm"))) {
      return;
    }
    try {
      await deleteProvider.mutateAsync({ provider: providerName });
      onProviderDeleted?.(providerName);
    } catch {
      // toast handled by mutation hook
    }
  };

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
      connectivity={connectivity}
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
      onModelsChange={handleModelsChange}
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
      onTestConnection={connectivity.testConnection}
    />
  );
}
