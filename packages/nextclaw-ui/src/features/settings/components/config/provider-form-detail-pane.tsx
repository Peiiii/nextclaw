import type { FormEventHandler } from "react";
import { CircleDotDashed, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { FormActions } from "@/shared/components/ui/actions/form-actions";
import { t } from "@/shared/lib/i18n";
import type { getLanguage } from "@/shared/lib/i18n";
import type { ThinkingLevel } from "@/shared/lib/api";
import {
  ConfigSplitDetailPane,
  ConfigSplitPaneBody,
  ConfigSplitPaneFooter,
  ConfigSplitPaneHeader,
} from "@/shared/components/config-split-page";
import { ProviderAdvancedSettingsSection } from "@/features/settings/components/config/provider-advanced-settings-section";
import { ProviderAuthSection } from "@/features/settings/components/config/provider-auth-section";
import { ProviderModelsSection } from "@/features/settings/components/config/provider-models-section";
import { ProviderStatusBadge } from "@/features/settings/components/config/provider-status-badge";
import type { useProviderConnectivity } from "@/features/settings/hooks/use-provider-connectivity";
import type { resolveProviderFormContext } from "@/features/settings/utils/provider-form-context.utils";
import {
  formatThinkingLevelLabel,
  THINKING_LEVELS,
  type ModelConfig,
  type WireApiType,
} from "@/features/settings/utils/provider-form-support.utils";

type ProviderFormDetailPaneProps = {
  context: ReturnType<typeof resolveProviderFormContext>;
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
  connectivity: ReturnType<typeof useProviderConnectivity>;
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
  onModelsChange: (models: string[]) => void;
  onRemoveModel: (modelName: string) => void;
  onToggleModelThinkingLevel: (modelName: string, level: ThinkingLevel) => void;
  onSetModelThinkingDefault: (
    modelName: string,
    level: ThinkingLevel | null,
  ) => void;
  onSetModelVision: (modelName: string, vision: boolean) => void;
  onShowAdvancedChange: (show: boolean) => void;
  onWireApiChange: (wireApi: WireApiType) => void;
  onExtraHeadersChange: (headers: Record<string, string> | null) => void;
  onDeleteProvider: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onTestConnection: () => void;
};

export function ProviderFormDetailPane(props: ProviderFormDetailPaneProps) {
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
    connectivity,
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
    onModelsChange,
    onRemoveModel,
    onToggleModelThinkingLevel,
    onSetModelThinkingDefault,
    onSetModelVision,
    onShowAdvancedChange,
    onWireApiChange,
    onExtraHeadersChange,
    onDeleteProvider,
    onSubmit,
    onTestConnection,
  } = props;
  const selectedAuthMethod = context.providerAuthMethods.find(
    (method) => method.id === resolvedAuthMethodId,
  );

  return (
    <ConfigSplitDetailPane>
      <ConfigSplitPaneHeader className="px-5 py-4">
        <div className="flex items-center justify-between">
          <h3 className="truncate text-lg font-semibold text-foreground">
            {providerTitle}
          </h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onDeleteProvider}
              disabled={isDeletePending}
              className="text-muted-foreground/70 transition-colors hover:text-red-500"
              title={t("providerDelete")}
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <ProviderStatusBadge
              enabled={context.currentEnabled}
              apiKeyRequired={context.resolvedProviderConfig.apiKeyRequired}
              apiKeySet={context.resolvedProviderConfig.apiKeySet}
            />
          </div>
        </div>
      </ConfigSplitPaneHeader>

      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <ConfigSplitPaneBody className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <Label
              htmlFor="providerDisplayName"
              className="text-sm font-medium text-foreground"
            >
              {t("providerDisplayName")}
            </Label>
            <Input
              id="providerDisplayName"
              type="text"
              value={providerDisplayName}
              onChange={(event) =>
                onProviderDisplayNameChange(event.target.value)
              }
              placeholder={
                context.defaultDisplayName ||
                t("providerDisplayNamePlaceholder")
              }
              className="rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              {t("providerDisplayNameHelpShort")}
            </p>
          </div>

          <ProviderAuthSection
            apiKey={apiKey}
            apiKeyRequired={
              context.resolvedProviderConfig.apiKeyRequired !== false
            }
            apiKeySet={context.resolvedProviderConfig.apiKeySet}
            apiKeyPlaceholder={
              context.apiKeyHint?.placeholder ?? t("enterApiKey")
            }
            providerAuth={context.providerAuth}
            providerAuthNote={
              context.providerAuth?.note?.[language] ||
              context.providerAuth?.note?.en ||
              context.providerAuth?.displayName ||
              ""
            }
            providerAuthMethodOptions={context.providerAuthMethodOptions}
            providerAuthMethodsCount={context.providerAuthMethods.length}
            selectedAuthMethodHint={
              selectedAuthMethod?.hint?.[language] ||
              selectedAuthMethod?.hint?.en ||
              ""
            }
            shouldUseAuthMethodPills={context.shouldUseAuthMethodPills}
            resolvedAuthMethodId={resolvedAuthMethodId}
            onAuthMethodChange={onAuthMethodChange}
            onStartProviderAuth={onStartProviderAuth}
            onImportProviderAuthFromCli={onImportProviderAuthFromCli}
            startPending={startPending}
            importPending={importPending}
            authSessionId={authSessionId}
            authStatusMessage={authStatusMessage}
            onApiKeyChange={onApiKeyChange}
          />

          <div className="space-y-2">
            <Label
              htmlFor="apiBase"
              className="text-sm font-medium text-foreground"
            >
              {t("apiBase")}
            </Label>
            <Input
              id="apiBase"
              type="text"
              value={apiBase}
              onChange={(event) => onApiBaseChange(event.target.value)}
              placeholder={
                context.defaultApiBase ||
                context.apiBaseHint?.placeholder ||
                "https://api.example.com"
              }
              className="rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              {context.apiBaseHelpText}
            </p>
          </div>

          <ProviderModelsSection
            key={context.providerConfig?.providerId}
            providerName={context.providerConfig?.providerId ?? ""}
            providerModelAliases={context.providerModelAliases}
            models={models}
            modelConfig={modelConfig}
            modelDraft={modelDraft}
            showModelInput={showModelInput}
            onModelDraftChange={onModelDraftChange}
            onShowModelInputChange={onShowModelInputChange}
            onAddModel={onAddModel}
            onModelsChange={onModelsChange}
            supportsModelDiscovery={context.supportsModelDiscovery}
            onDiscoverModels={connectivity.discoverModels}
            isDiscoveringModels={connectivity.isDiscoveringModels}
            fetchedModels={connectivity.fetchedModels}
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
            wireApiLabel={t("wireApi")}
            wireApi={wireApi}
            onWireApiChange={onWireApiChange}
            shouldUseWireApiPills={context.shouldUseWireApiPills}
            wireApiSelectOptions={context.wireApiSelectOptions}
            extraHeadersLabel={t("extraHeaders")}
            extraHeaders={extraHeaders}
            onExtraHeadersChange={onExtraHeadersChange}
          />
        </ConfigSplitPaneBody>

        <ConfigSplitPaneFooter>
          <FormActions align="between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onTestConnection}
              disabled={connectivity.isTestPending}
            >
              <CircleDotDashed className="mr-1.5 h-3.5 w-3.5" />
              {connectivity.isTestPending
                ? t("providerTestingConnection")
                : t("providerTestConnection")}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isUpdatePending || !hasChanges}
            >
              {isUpdatePending
                ? t("saving")
                : hasChanges
                  ? t("save")
                  : t("unchanged")}
            </Button>
          </FormActions>
        </ConfigSplitPaneFooter>
      </form>
    </ConfigSplitDetailPane>
  );
}
