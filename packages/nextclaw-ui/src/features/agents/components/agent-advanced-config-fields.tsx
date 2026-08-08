import type { AgentEditFormState } from "@/features/agents/types/agent-form.types";
import { Input } from "@/shared/components/ui/input";
import { t } from "@/shared/lib/i18n";
import { ChevronDown, Settings2 } from "lucide-react";

type AgentAdvancedConfigFieldsProps = {
  form: AgentEditFormState;
  disabled?: boolean;
  onChange: (patch: Partial<AgentEditFormState>) => void;
};

export function AgentAdvancedConfigFields({
  form,
  disabled = false,
  onChange,
}: AgentAdvancedConfigFieldsProps) {
  return (
    <details className="group rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <Settings2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{t("agentsAdvancedConfigToggle")}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-border/60 px-4 py-4">
        <p className="text-xs leading-5 text-muted-foreground">
          {t("agentsAdvancedConfigDescription")}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <AgentNumberField
            label={t("agentsAdvancedContextTokensLabel")}
            value={form.contextTokens}
            min={1000}
            step={1000}
            disabled={disabled}
            onChange={(contextTokens) => onChange({ contextTokens })}
          />
        </div>
      </div>
    </details>
  );
}

function AgentNumberField(props: {
  label: string;
  value: string;
  min: number;
  step: number;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const { label, value, min, step, disabled, onChange } = props;

  return (
    <label className="space-y-2 text-sm font-medium text-foreground">
      <span>{label}</span>
      <Input
        type="number"
        min={min}
        step={step}
        value={value}
        disabled={disabled}
        placeholder={t("agentsAdvancedInheritPlaceholder")}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
