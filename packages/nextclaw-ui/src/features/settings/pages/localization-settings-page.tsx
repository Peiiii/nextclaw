import { useCallback, useMemo, useState } from "react";
import { Check, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { SettingRow, SettingsGroup, SettingsSection } from "@/shared/components/settings/setting-row";
import { SettingsPage } from "@/shared/components/settings/settings-page";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

export type MarketplaceSource = "auto" | "official" | "domestic";

const SOURCE_STORAGE_KEY = "nextclaw.localization.marketplace-source";
const GITHUB_MIRROR_STORAGE_KEY = "nextclaw.localization.github-mirror";

export const MARKETPLACE_SOURCE_OPTIONS: Array<{
  value: MarketplaceSource;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: "auto",
    labelKey: "localizationSourceAuto",
    descriptionKey: "localizationSourceAutoDescription",
  },
  {
    value: "official",
    labelKey: "localizationSourceOfficial",
    descriptionKey: "localizationSourceOfficialDescription",
  },
  {
    value: "domestic",
    labelKey: "localizationSourceDomestic",
    descriptionKey: "localizationSourceDomesticDescription",
  },
];

const GITHUB_MIRROR_PRESETS: Array<{ value: string; labelKey: string }> = [
  { value: "", labelKey: "localizationMirrorDirect" },
  { value: "https://ghproxy.net/", labelKey: "ghproxy" },
  { value: "https://mirror.ghproxy.com/", labelKey: "ghproxy.com" },
  { value: "https://gh-proxy.com/", labelKey: "gh-proxy.com" },
];

const DOMESTIC_MARKETPLACE_BASE = "https://api.nextclaw.net";
const OFFICIAL_MARKETPLACE_BASE = "https://marketplace-api.nextclaw.io";

function readStoredSource(): MarketplaceSource {
  try {
    const raw = window.localStorage.getItem(SOURCE_STORAGE_KEY);
    if (raw === "official" || raw === "domestic") {
      return raw;
    }
  } catch {
    // ignore storage failures
  }
  return "auto";
}

function readStoredMirror(): string {
  try {
    const raw = window.localStorage.getItem(GITHUB_MIRROR_STORAGE_KEY);
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
}

export function LocalizationSettingsPage() {
  const [source, setSource] = useState<MarketplaceSource>(readStoredSource);
  const [mirror, setMirror] = useState<string>(readStoredMirror);
  const [draftMirror, setDraftMirror] = useState<string>(readStoredMirror);
  const [mirrorSaved, setMirrorSaved] = useState(false);

  const resolvedMarketplaceBase = useMemo(() => {
    if (source === "domestic") {
      return DOMESTIC_MARKETPLACE_BASE;
    }
    if (source === "official") {
      return OFFICIAL_MARKETPLACE_BASE;
    }
    return `${DOMESTIC_MARKETPLACE_BASE}（自动回退 ${OFFICIAL_MARKETPLACE_BASE}）`;
  }, [source]);

  const changeSource = useCallback((next: MarketplaceSource) => {
    setSource(next);
    try {
      window.localStorage.setItem(SOURCE_STORAGE_KEY, next);
    } catch {
      // ignore storage failures
    }
  }, []);

  const selectMirrorPreset = useCallback((preset: string) => {
    setDraftMirror(preset);
    setMirrorSaved(false);
  }, []);

  const saveMirror = useCallback(() => {
    const trimmed = draftMirror.trim().replace(/\/+$/, "") + (draftMirror.trim() ? "/" : "");
    setMirror(trimmed);
    setDraftMirror(trimmed);
    setMirrorSaved(true);
    try {
      window.localStorage.setItem(GITHUB_MIRROR_STORAGE_KEY, trimmed);
    } catch {
      // ignore storage failures
    }
  }, [draftMirror]);

  return (
    <SettingsPage title={t("localization")}>
      <SettingsSection>
        <SettingsGroup>
          <SettingRow
            title={t("localizationSourceTitle")}
            description={t("localizationSourceDescription")}
            layout="stacked"
          >
            <div
              role="radiogroup"
              aria-label={t("localizationSourceTitle")}
              className="grid gap-1 rounded-xl bg-background/65 p-1 sm:grid-cols-3"
            >
              {MARKETPLACE_SOURCE_OPTIONS.map((option) => {
                const selected = option.value === source;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => changeSource(option.value)}
                    className={cn(
                      "flex min-w-0 items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                      selected
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1",
                        selected ? "bg-primary text-primary-foreground ring-primary" : "bg-background ring-border"
                      )}
                    >
                      {selected ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{t(option.labelKey)}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {t(option.descriptionKey)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("localizationSourceResolved")}:{" "}
              <span className="font-medium text-foreground">{resolvedMarketplaceBase}</span>
            </p>
          </SettingRow>
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection>
        <SettingsGroup>
          <SettingRow
            title={t("localizationMirrorTitle")}
            description={t("localizationMirrorDescription")}
            layout="stacked"
          >
            <div className="flex w-full max-w-md flex-wrap items-center gap-2">
              <Select value={draftMirror} onValueChange={selectMirrorPreset}>
                <SelectTrigger aria-label={t("localizationMirrorPreset")} className="w-44">
                  <SelectValue placeholder={t("localizationMirrorPreset")} />
                </SelectTrigger>
                <SelectContent>
                  {GITHUB_MIRROR_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {t(preset.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={draftMirror}
                onChange={(event) => {
                  setDraftMirror(event.target.value);
                  setMirrorSaved(false);
                }}
                placeholder="https://mirror.example.com/"
                aria-label={t("localizationMirrorCustom")}
                className="h-8 max-w-[16rem]"
              />
              <Button type="button" size="sm" onClick={saveMirror}>
                <RefreshCw className="h-3.5 w-3.5" />
                {t("save")}
              </Button>
            </div>
            {mirrorSaved ? (
              <p className="mt-2 text-xs text-emerald-700">{t("localizationMirrorSaved")}</p>
            ) : null}
            {mirror ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("localizationMirrorActive")}:{" "}
                <span className="font-medium text-foreground">
                  {mirror.replace(/^https?:\/\//, "")}
                </span>
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{t("localizationMirrorInactive")}</p>
            )}
          </SettingRow>
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection>
        <SettingsGroup>
          <SettingRow
            title={t("localizationBuiltinTitle")}
            description={t("localizationBuiltinDescription")}
            layout="stacked"
          >
            <a
              href="/marketplace"
              className="inline-flex max-w-md items-center gap-1.5 rounded-lg border border-border bg-background/55 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background"
            >
              {t("localizationBuiltinEntry")}
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          </SettingRow>
        </SettingsGroup>
      </SettingsSection>
    </SettingsPage>
  );
}
