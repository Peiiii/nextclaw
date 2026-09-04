import { useCallback, useMemo, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import {
  decryptLocal,
  encryptLocal,
  randomSalt,
} from "@nextclaw/shared";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { SettingRow, SettingsGroup, SettingsSection } from "@/shared/components/settings/setting-row";
import { SettingsPage } from "@/shared/components/settings/settings-page";
import { t } from "@/shared/lib/i18n";

const PSEUDONYM_ENABLED_KEY = "nextclaw.pseudonym.enabled";
const PSEUDONYM_MODEL_KEY = "nextclaw.pseudonym.model";
const PSEUDONYM_PASSPHRASE_KEY = "nextclaw.pseudonym.passphrase";
const PSEUDONYM_MAPPING_KEY = "nextclaw.pseudonym.mapping";

function readStoredFlag(key: string, fallback: boolean): boolean {
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

function readStoredString(key: string): string {
  try {
    const raw = window.localStorage.getItem(key);
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
}

/**
 * 极限托名模式（Pseudonym Mode）设置页。
 *
 * 开启后，所有对外消息先经本地脱敏（复用脱敏模式规则），再使用用户选择的
 * 本地小模型进行实体替换（人名/地名/组织/数字 → 随机代称），替换映射表用
 * 本地密钥 AES-GCM 加密存储，本地加密、本地解密，数据不出本机。
 */
export function PseudonymSettingsPage() {
  const [enabled, setEnabled] = useState(() => readStoredFlag(PSEUDONYM_ENABLED_KEY, false));
  const [model, setModel] = useState(() => readStoredString(PSEUDONYM_MODEL_KEY));
  const [passphrase, setPassphrase] = useState(() => readStoredString(PSEUDONYM_PASSPHRASE_KEY));
  const [passphraseConfirm, setPassphraseConfirm] = useState("");
  const [mappingPreview, setMappingPreview] = useState("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const isLocalModel = useMemo(() => {
    const trimmed = model.trim().toLowerCase();
    if (!trimmed) {
      return false;
    }
    return (
      trimmed.startsWith("ollama") ||
      trimmed.startsWith("http://127.0.0.1") ||
      trimmed.startsWith("http://localhost") ||
      trimmed.startsWith("local:") ||
      trimmed.startsWith("lmstudio") ||
      trimmed.startsWith("llama")
    );
  }, [model]);

  const toggleEnabled = useCallback((next: boolean) => {
    setEnabled(next);
    try {
      window.localStorage.setItem(PSEUDONYM_ENABLED_KEY, String(next));
    } catch {
      // ignore storage failures
    }
  }, []);

  const saveSettings = useCallback(async () => {
    const trimmedModel = model.trim();
    if (!trimmedModel) {
      setSaveStatus(t("pseudonymModelRequired"));
      return;
    }
    if (!isLocalModel) {
      setSaveStatus(t("pseudonymModelMustBeLocal"));
      return;
    }
    if (passphrase.length < 8) {
      setSaveStatus(t("pseudonymPassphraseShort"));
      return;
    }
    if (passphrase !== passphraseConfirm) {
      setSaveStatus(t("pseudonymPassphraseMismatch"));
      return;
    }
    try {
      window.localStorage.setItem(PSEUDONYM_MODEL_KEY, trimmedModel);
      window.localStorage.setItem(PSEUDONYM_PASSPHRASE_KEY, passphrase);
      // 用加密能力做一次自检：加密一段示例文本并解密，确保密钥可用。
      const probe = await encryptLocal(passphrase, "probe");
      await decryptLocal(passphrase, probe);
      setSaveStatus(t("pseudonymSaved"));
    } catch {
      setSaveStatus(t("pseudonymSaveFailed"));
    }
  }, [isLocalModel, model, passphrase, passphraseConfirm]);

  const generatePassphrase = useCallback(() => {
    try {
      const bytes = randomSalt();
      const generated = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
      setPassphrase(generated);
      setPassphraseConfirm(generated);
      setSaveStatus(t("pseudonymPassphraseGenerated"));
    } catch {
      setSaveStatus(t("pseudonymSaveFailed"));
    }
  }, []);

  return (
    <SettingsPage title={t("pseudonym")}>
      <SettingsSection>
        <SettingsGroup>
          <SettingRow
            title={t("pseudonymEnabledTitle")}
            description={t("pseudonymEnabledDescription")}
            control={
              <Switch
                id="pseudonym-enabled"
                aria-label={t("pseudonymEnabledTitle")}
                checked={enabled}
                onCheckedChange={toggleEnabled}
              />
            }
          />
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection>
        <SettingsGroup>
          <SettingRow
            title={t("pseudonymModelTitle")}
            description={t("pseudonymModelDescription")}
            layout="stacked"
          >
            <Input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder={t("pseudonymModelPlaceholder")}
              aria-label={t("pseudonymModelTitle")}
              disabled={!enabled}
              className="max-w-md"
            />
            {model.trim() && isLocalModel ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t("pseudonymModelLocalConfirmed")}
              </p>
            ) : model.trim() ? (
              <p className="mt-1.5 text-xs text-amber-600">
                {t("pseudonymModelMustBeLocal")}
              </p>
            ) : null}
          </SettingRow>

          <SettingRow
            title={t("pseudonymPassphraseTitle")}
            description={t("pseudonymPassphraseDescription")}
            layout="stacked"
          >
            <div className="flex w-full max-w-md flex-wrap items-center gap-2">
              <Input
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                placeholder={t("pseudonymPassphrasePlaceholder")}
                aria-label={t("pseudonymPassphraseTitle")}
                disabled={!enabled}
                className="max-w-[14rem]"
              />
              <Input
                type="password"
                value={passphraseConfirm}
                onChange={(event) => setPassphraseConfirm(event.target.value)}
                placeholder={t("pseudonymPassphraseConfirmPlaceholder")}
                aria-label={t("pseudonymPassphraseConfirmPlaceholder")}
                disabled={!enabled}
                className="max-w-[14rem]"
              />
              <Button
                type="button"
                size="sm"
                onClick={generatePassphrase}
                disabled={!enabled}
                variant="outline"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {t("pseudonymPassphraseGenerate")}
              </Button>
            </div>
          </SettingRow>

          <SettingRow
            title={t("pseudonymMappingTitle")}
            description={t("pseudonymMappingDescription")}
            layout="stacked"
          >
            <textarea
              value={mappingPreview}
              onChange={(event) => setMappingPreview(event.target.value)}
              placeholder={t("pseudonymMappingPlaceholder")}
              aria-label={t("pseudonymMappingTitle")}
              disabled={!enabled}
              className="h-20 w-full max-w-md resize-none rounded-lg border border-border bg-background/65 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("pseudonymMappingHint")}</p>
          </SettingRow>

          <SettingRow title={t("pseudonymSaved")} layout="stacked">
            <Button type="button" size="sm" onClick={saveSettings} disabled={!enabled}>
              {t("save")}
            </Button>
            {saveStatus ? (
              <p className="mt-1.5 text-xs text-muted-foreground">{saveStatus}</p>
            ) : null}
          </SettingRow>
        </SettingsGroup>
      </SettingsSection>
    </SettingsPage>
  );
}
