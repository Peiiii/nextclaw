import { SettingRow } from "@/shared/components/ui/setting-row";
import { Switch } from "@/shared/components/ui/switch";
import { t } from "@/shared/lib/i18n";

type ProviderEnabledFieldProps = { enabled: boolean; onChange: (enabled: boolean) => void };

export function ProviderEnabledField(props: ProviderEnabledFieldProps) {
  const { enabled, onChange } = props;
  return (
    <SettingRow
      tone="muted"
      title={t("enabled")}
      control={
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {enabled ? t("enabled") : t("disabled")}
          </span>
          <Switch checked={enabled} onCheckedChange={onChange} />
        </div>
      }
    />
  );
}
