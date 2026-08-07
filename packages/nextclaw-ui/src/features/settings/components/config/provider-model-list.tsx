import { useMemo, useState } from "react";
import { Settings2, Trash2, X } from "lucide-react";
import type { ThinkingLevel } from "@/shared/lib/api";
import { Label } from "@/shared/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { t } from "@/shared/lib/i18n";

export type ProviderModelConfig = Record<
  string,
  {
    thinking?: { supported: ThinkingLevel[]; default?: ThinkingLevel | null };
    vision?: boolean;
  }
>;

type ProviderModelListProps = {
  models: string[];
  modelConfig: ProviderModelConfig;
  onModelsChange: (models: string[]) => void;
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

export function ProviderModelList(props: ProviderModelListProps) {
  const {
    models,
    modelConfig,
    onModelsChange,
    onRemoveModel,
    onToggleModelThinkingLevel,
    onSetModelThinkingDefault,
    onSetModelVision,
    thinkingLevels,
    formatThinkingLevelLabel,
  } = props;
  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const selectedModels = useMemo(
    () => models.filter((model) => selection.has(model)),
    [models, selection],
  );
  const toggleModel = (modelName: string) => {
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(modelName)) {
        next.delete(modelName);
      } else {
        next.add(modelName);
      }
      return next;
    });
  };
  const stopSelecting = () => {
    setSelecting(false);
    setSelection(new Set());
  };
  const removeSelected = () => {
    if (selectedModels.length === 0) {
      return;
    }
    onModelsChange(models.filter((model) => !selection.has(model)));
    stopSelecting();
  };

  return (
    <div className="space-y-2">
      <div className="flex min-h-7 flex-wrap items-center justify-end gap-2">
        {selecting ? (
          <>
            <span className="mr-auto text-xs text-muted-foreground">
              {t("providerModelsSuggestionsSelected").replace(
                "{count}",
                String(selectedModels.length),
              )}
            </span>
            <button
              type="button"
              className="text-xs font-medium text-primary hover:text-primary/80"
              onClick={() =>
                setSelection(
                  selectedModels.length === models.length
                    ? new Set()
                    : new Set(models),
                )
              }
            >
              {t(
                selectedModels.length === models.length
                  ? "providerModelsClearSelection"
                  : "providerModelsSelectAll",
              )}
            </button>
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={stopSelecting}
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              disabled={selectedModels.length === 0}
              className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-45"
              onClick={removeSelected}
            >
              <Trash2 className="h-3 w-3" />
              {t("providerModelsRemoveSelected")}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setSelecting(true)}
          >
            <Trash2 className="h-3 w-3" />
            {t("providerModelsBulkRemove")}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {models.map((modelName) => {
          if (selecting) {
            return (
              <label
                key={modelName}
                className="inline-flex max-w-full cursor-pointer items-center gap-2 rounded-full border border-border/55 bg-muted/45 px-3 py-1.5 hover:bg-muted/70"
              >
                <input
                  type="checkbox"
                  checked={selection.has(modelName)}
                  onChange={() => toggleModel(modelName)}
                  aria-label={t("providerModelsSuggestionSelect").replace(
                    "{model}",
                    modelName,
                  )}
                  className="h-3.5 w-3.5 shrink-0 accent-primary"
                />
                <span className="max-w-[140px] truncate text-sm text-foreground sm:max-w-[220px]">
                  {modelName}
                </span>
              </label>
            );
          }

          const modelEntry = modelConfig[modelName];
          const thinkingEntry = modelEntry?.thinking;
          const supportedLevels = thinkingEntry?.supported ?? [];
          const defaultThinkingLevel = thinkingEntry?.default ?? null;
          const visionEnabled = modelEntry?.vision === true;

          return (
            <div
              key={modelName}
              className="group inline-flex max-w-full items-center gap-1 rounded-full border border-border/55 bg-muted/45 px-3 py-1.5"
            >
              <span className="max-w-[140px] truncate text-sm text-foreground sm:max-w-[220px]">
                {modelName}
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/70 opacity-100 transition-opacity hover:bg-muted hover:text-foreground md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                    aria-label={t("providerModelThinkingTitle")}
                    title={t("providerModelThinkingTitle")}
                  >
                    <Settings2 className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        {t("providerModelVisionTitle")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("providerModelVisionHint")}
                      </p>
                    </div>
                    <Switch
                      checked={visionEnabled}
                      onCheckedChange={(checked) =>
                        onSetModelVision(modelName, checked)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">
                      {t("providerModelThinkingTitle")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("providerModelThinkingHint")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {thinkingLevels.map((level) => {
                      const selected = supportedLevels.includes(level);
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() =>
                            onToggleModelThinkingLevel(modelName, level)
                          }
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                            selected
                              ? "border-foreground/15 bg-foreground text-background"
                              : "border-border/55 bg-muted/50 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          {formatThinkingLevelLabel(level)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">
                      {t("providerModelThinkingDefault")}
                    </Label>
                    <Select
                      value={defaultThinkingLevel ?? "__none__"}
                      onValueChange={(value) =>
                        onSetModelThinkingDefault(
                          modelName,
                          value === "__none__"
                            ? null
                            : (value as ThinkingLevel),
                        )
                      }
                      disabled={supportedLevels.length === 0}
                    >
                      <SelectTrigger className="h-8 rounded-lg text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          {t("providerModelThinkingDefaultNone")}
                        </SelectItem>
                        {supportedLevels.map((level) => (
                          <SelectItem key={level} value={level}>
                            {formatThinkingLevelLabel(level)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {supportedLevels.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {t("providerModelThinkingNoSupported")}
                      </p>
                    ) : null}
                  </div>
                </PopoverContent>
              </Popover>
              <button
                type="button"
                onClick={() => onRemoveModel(modelName)}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/70 opacity-100 transition-opacity hover:bg-muted hover:text-foreground md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                aria-label={t("remove")}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
      {selecting ? (
        <p className="text-xs text-muted-foreground">
          {t("providerModelsRemoveSaveHint")}
        </p>
      ) : null}
    </div>
  );
}
