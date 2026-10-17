import { useCallback, useMemo, useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import {
  DEFAULT_REDACTION_RULES,
  redactWithDefaults,
  type RedactionRule,
} from "@nextclaw/shared";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { SettingRow, SettingsGroup, SettingsSection } from "@/shared/components/settings/setting-row";
import { SettingsPage } from "@/shared/components/settings/settings-page";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

const STORAGE_KEY = "nextclaw.redaction.custom-keywords";
const ENABLED_KEY = "nextclaw.redaction.enabled";
const OPTIONAL_RULES_KEY = "nextclaw.redaction.optional-rules";

function readStorageList(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function writeStorageList(key: string, value: string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
}

function readStorageFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    return raw === "true";
  } catch {
    return fallback;
  }
}

export function RedactionSettingsPage() {
  const [enabled, setEnabled] = useState(() => readStorageFlag(ENABLED_KEY, false));
  const [customKeywords, setCustomKeywords] = useState(() => readStorageList(STORAGE_KEY));
  const [optionalRuleIds, setOptionalRuleIds] = useState(() => readStorageList(OPTIONAL_RULES_KEY));
  const [draftKeyword, setDraftKeyword] = useState("");
  const [previewText, setPreviewText] = useState("");

  const customRules: RedactionRule[] = useMemo(
    () =>
      customKeywords.map((keyword, index) => ({
        id: `custom:${index}`,
        kind: "keyword" as const,
        label: keyword,
        keyword,
        optional: true,
      })),
    [customKeywords],
  );

  const optionalRuleIdSet = useMemo(() => new Set(optionalRuleIds), [optionalRuleIds]);
  const preview = useMemo(
    () => (previewText ? redactWithDefaults(previewText, customRules, optionalRuleIdSet) : null),
    [previewText, customRules, optionalRuleIdSet],
  );

  const toggleEnabled = useCallback((next: boolean) => {
    setEnabled(next);
    try {
      window.localStorage.setItem(ENABLED_KEY, String(next));
    } catch {
      // ignore storage failures
    }
  }, []);

  const toggleOptionalRule = useCallback(
    (ruleId: string) => {
      const next = optionalRuleIdSet.has(ruleId)
        ? optionalRuleIds.filter((id) => id !== ruleId)
        : [...optionalRuleIds, ruleId];
      setOptionalRuleIds(next);
      writeStorageList(OPTIONAL_RULES_KEY, next);
    },
    [optionalRuleIdSet, optionalRuleIds],
  );

  const addKeyword = useCallback(() => {
    const trimmed = draftKeyword.trim();
    if (!trimmed) {
      return;
    }
    const next = [...customKeywords, trimmed];
    setCustomKeywords(next);
    writeStorageList(STORAGE_KEY, next);
    setDraftKeyword("");
  }, [customKeywords, draftKeyword]);

  const removeKeyword = useCallback(
    (keyword: string) => {
      const next = customKeywords.filter((item) => item !== keyword);
      setCustomKeywords(next);
      writeStorageList(STORAGE_KEY, next);
    },
    [customKeywords],
  );

  return (
    <SettingsPage title={t("redaction")}>
      <SettingsSection>
        <SettingsGroup>
          <SettingRow
            title={t("redactionEnabledTitle")}
            description={t("redactionEnabledDescription")}
            control={
              <Switch
                id="redaction-enabled"
                aria-label={t("redactionEnabledTitle")}
                checked={enabled}
                onCheckedChange={toggleEnabled}
              />
            }
          />
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection>
        <SettingsGroup>
          {DEFAULT_REDACTION_RULES.map((rule) => {
            const isOptional = rule.optional === true;
            const isActive = !isOptional || optionalRuleIdSet.has(rule.id);
            return (
              <SettingRow
                key={rule.id}
                title={t(rule.label)}
                control={
                  isOptional ? (
                    <Switch
                      id={`redaction-rule-${rule.id}`}
                      aria-label={t(rule.label)}
                      checked={isActive}
                      onCheckedChange={() => toggleOptionalRule(rule.id)}
                      disabled={!enabled}
                    />
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      {t("redactionRuleBuiltin")}
                    </span>
                  )
                }
              />
            );
          })}
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection>
        <SettingsGroup>
          <SettingRow
            title={t("redactionCustomTitle")}
            description={t("redactionCustomDescription")}
            layout="stacked"
          >
            <div className="flex w-full max-w-md gap-2">
              <Input
                value={draftKeyword}
                onChange={(event) => setDraftKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    addKeyword();
                  }
                }}
                placeholder={t("redactionCustomPlaceholder")}
                aria-label={t("redactionCustomPlaceholder")}
                className="h-8"
                disabled={!enabled}
              />
              <Button
                type="button"
                size="sm"
                onClick={addKeyword}
                disabled={!enabled || !draftKeyword.trim()}
                aria-label={t("redactionCustomAdd")}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {customKeywords.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {customKeywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                  >
                    {keyword}
                    <button
                      type="button"
                      aria-label={t("redactionCustomRemove")}
                      onClick={() => removeKeyword(keyword)}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </SettingRow>
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection>
        <SettingsGroup>
          <SettingRow
            title={t("redactionPreviewTitle")}
            description={t("redactionPreviewDescription")}
            layout="stacked"
          >
            <textarea
              value={previewText}
              onChange={(event) => setPreviewText(event.target.value)}
              placeholder={t("redactionPreviewPlaceholder")}
              aria-label={t("redactionPreviewTitle")}
              disabled={!enabled}
              className="h-20 w-full max-w-md resize-none rounded-lg border border-border bg-background/65 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {preview ? (
              <div className="mt-2 w-full max-w-md">
                <p
                  className={cn(
                    "rounded-lg border border-border/70 bg-background/55 px-3 py-2 text-sm whitespace-pre-wrap",
                    preview.matchedRuleIds.length > 0 && "border-emerald-200 bg-emerald-50/40",
                  )}
                  data-testid="redaction-preview-result"
                >
                  {preview.text}
                </p>
                {preview.matchedRuleIds.length > 0 ? (
                  <p className="mt-1.5 text-xs text-emerald-700">
                    {t("redactionPreviewMatched")}: {preview.matchedRuleIds.join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </SettingRow>
        </SettingsGroup>
      </SettingsSection>
    </SettingsPage>
  );
}
