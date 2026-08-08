import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { t } from "@/shared/lib/i18n";
import type { ThinkingLevel } from "@/shared/lib/api";
import { useProviderModelSuggestions } from "@/features/settings/hooks/use-provider-model-suggestions";
import {
  ProviderModelList,
  type ProviderModelConfig,
} from "./provider-model-list";
import { ProviderModelSuggestionsPanel } from "./provider-model-suggestions-panel";
import { AlertCircle, LoaderCircle, Plus, RefreshCw, X } from "lucide-react";
import { useRef, useState } from "react";

type ProviderModelsSectionProps = {
  providerName: string;
  providerModelAliases: string[];
  models: string[];
  modelConfig: ProviderModelConfig;
  modelDraft: string;
  showModelInput: boolean;
  onModelDraftChange: (value: string) => void;
  onShowModelInputChange: (value: boolean) => void;
  onAddModel: () => void;
  onModelsChange: (models: string[]) => void;
  supportsModelDiscovery: boolean;
  onDiscoverModels: () => Promise<string[] | null>;
  isDiscoveringModels: boolean;
  fetchedModels: string[];
  onRemoveModel: (modelName: string) => void;
  onToggleModelThinkingLevel: (modelName: string, level: ThinkingLevel) => void;
  onSetModelThinkingDefault: (
    modelName: string,
    level: ThinkingLevel | null,
  ) => void;
  onSetModelVision: (modelName: string, vision: boolean) => void;
  thinkingLevels: ThinkingLevel[];
  formatThinkingLevelLabel: (level: ThinkingLevel) => string;
};

function ProviderModelCatalogError({
  hasFetchedCatalog,
  hasSuggestionError,
  supportsModelDiscovery,
}: {
  hasFetchedCatalog: boolean;
  hasSuggestionError: boolean;
  supportsModelDiscovery: boolean;
}) {
  if (!supportsModelDiscovery || !hasSuggestionError || hasFetchedCatalog) {
    return null;
  }
  return (
    <div className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {t("providerModelsSuggestionsFailed")}
    </div>
  );
}

export function ProviderModelsSection(props: ProviderModelsSectionProps) {
  const {
    providerName,
    providerModelAliases,
    models,
    modelConfig,
    modelDraft,
    showModelInput,
    onModelDraftChange,
    onShowModelInputChange,
    onAddModel,
    onModelsChange,
    supportsModelDiscovery,
    onDiscoverModels,
    isDiscoveringModels,
    fetchedModels,
    onRemoveModel,
    onToggleModelThinkingLevel,
    onSetModelThinkingDefault,
    onSetModelVision,
    thinkingLevels,
    formatThinkingLevelLabel,
  } = props;
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const {
    addSuggestedModels,
    hasSuggestionError,
    isCheckingSuggestions,
    suggestedModels,
    suggestionSource,
  } = useProviderModelSuggestions({
    providerName,
    models,
    aliases: providerModelAliases,
    fetchedModels,
    onModelsChange,
  });
  const handleDiscoverModels = async () => {
    const result = await onDiscoverModels();
    if (result) {
      setSuggestionsExpanded(true);
      window.requestAnimationFrame(() => {
        const suggestions = suggestionsRef.current;
        suggestions?.scrollIntoView?.({ behavior: "smooth", block: "center" });
        suggestions?.focus({ preventScroll: true });
      });
    }
  };
  const hasFetchedCatalog = fetchedModels.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-foreground">
          {t("providerModelsTitle")}
        </Label>
        <div className="flex items-center gap-3">
          {supportsModelDiscovery ? (
            <button
              type="button"
              onClick={handleDiscoverModels}
              disabled={isDiscoveringModels}
              className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3 w-3 ${isDiscoveringModels ? "animate-spin" : ""}`}
              />
              {isDiscoveringModels
                ? t("providerModelsFetching")
                : t("providerModelsFetch")}
            </button>
          ) : null}
          {!showModelInput ? (
            <button
              type="button"
              onClick={() => onShowModelInputChange(true)}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
            >
              <Plus className="h-3 w-3" />
              {t("providerAddModel")}
            </button>
          ) : null}
        </div>
      </div>

      {showModelInput ? (
        <div className="flex items-center gap-2">
          <Input
            value={modelDraft}
            onChange={(event) => onModelDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAddModel();
              }
              if (event.key === "Escape") {
                onShowModelInputChange(false);
                onModelDraftChange("");
              }
            }}
            placeholder={t("providerModelInputPlaceholder")}
            className="flex-1 rounded-xl"
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            onClick={onAddModel}
            disabled={modelDraft.trim().length === 0}
          >
            {t("add")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              onShowModelInputChange(false);
              onModelDraftChange("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <ProviderModelCatalogError
        hasFetchedCatalog={hasFetchedCatalog}
        hasSuggestionError={hasSuggestionError}
        supportsModelDiscovery={supportsModelDiscovery}
      />

      {supportsModelDiscovery && isCheckingSuggestions && !hasFetchedCatalog ? (
        <div className="flex items-center gap-2 rounded-xl bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          {t("providerModelsSuggestionsChecking")}
        </div>
      ) : supportsModelDiscovery &&
        (suggestedModels.length > 0 || hasFetchedCatalog) ? (
        <div
          ref={suggestionsRef}
          tabIndex={-1}
          aria-live="polite"
          className="scroll-m-4 outline-none"
        >
          <ProviderModelSuggestionsPanel
            expanded={suggestionsExpanded}
            fetchedTotal={fetchedModels.length}
            models={suggestedModels}
            source={suggestionSource}
            onExpandedChange={setSuggestionsExpanded}
            onAddModels={addSuggestedModels}
          />
        </div>
      ) : null}

      {models.length === 0 ? (
        <div className="rounded-xl bg-muted/35 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("providerModelsEmptyShort")}
          </p>
          {!showModelInput ? (
            <button
              type="button"
              onClick={() => onShowModelInputChange(true)}
              className="mt-2 text-sm font-medium text-primary hover:text-primary/80"
            >
              {t("providerAddFirstModel")}
            </button>
          ) : null}
        </div>
      ) : (
        <ProviderModelList
          models={models}
          modelConfig={modelConfig}
          onModelsChange={onModelsChange}
          onRemoveModel={onRemoveModel}
          onToggleModelThinkingLevel={onToggleModelThinkingLevel}
          onSetModelThinkingDefault={onSetModelThinkingDefault}
          onSetModelVision={onSetModelVision}
          thinkingLevels={thinkingLevels}
          formatThinkingLevelLabel={formatThinkingLevelLabel}
        />
      )}
    </div>
  );
}
