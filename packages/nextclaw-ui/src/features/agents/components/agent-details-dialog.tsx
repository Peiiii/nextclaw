import type { ReactNode } from "react";
import type { AgentProfileView, ConfigView } from "@/shared/lib/api";
import { normalizeSessionType, resolveSessionTypeLabel } from "@/features/chat";
import { AgentAvatar } from "@/shared/components/common/agent-avatar";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { Bot, Brain, Gauge, Pencil, Sparkles, type LucideIcon } from "lucide-react";

type AgentDefaultsView = ConfigView["agents"]["defaults"];

type AgentDetailsDialogProps = {
  agent: AgentProfileView | null;
  defaults?: AgentDefaultsView;
  runtimeOptions: { value: string; label: string }[];
  defaultRuntime: string;
  defaultRuntimeLabel: string;
  onOpenChange: (open: boolean) => void;
  onEdit: (agent: AgentProfileView) => void;
};

const numberFormatter = new Intl.NumberFormat();

export function AgentDetailsDialog({
  agent,
  defaults,
  runtimeOptions,
  defaultRuntime,
  defaultRuntimeLabel,
  onOpenChange,
  onEdit,
}: AgentDetailsDialogProps) {
  if (!agent) {
    return null;
  }

  const model = resolveTextValue(agent.model, defaults?.model);
  const runtime = resolveRuntimeValue({
    agent,
    defaults,
    runtimeOptions,
    defaultRuntime,
    defaultRuntimeLabel,
  });
  const contextTokens = resolveNumberValue(
    agent.contextTokens,
    defaults?.contextTokens ?? 200000,
  );
  const reservedContextTokens = resolveNumberValue(
    agent.reservedContextTokens,
    defaults?.reservedContextTokens,
  );
  const maxToolIterations = resolveNumberValue(
    agent.maxToolIterations,
    defaults?.maxToolIterations ?? 1000,
  );
  const thinkingDefault = resolveTextValue(
    agent.thinkingDefault,
    defaults?.thinkingDefault ?? "off",
  );
  const runtimeConfig = resolveRecordValue(
    agent.runtimeConfig ?? agent.engineConfig,
    defaults?.engineConfig,
  );
  const models = resolveRecordValue(agent.models, defaults?.models);

  return (
    <Dialog open={agent !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden border-none bg-white p-0 sm:max-h-[720px] sm:max-w-2xl">
        <div className="shrink-0 px-5 pb-3 pt-5">
          <DialogHeader className="text-left">
            <div className="flex min-w-0 items-center gap-3">
              <AgentAvatar
                agentId={agent.id}
                displayName={agent.displayName}
                avatarUrl={agent.avatarUrl}
                className="h-10 w-10 shrink-0"
              />
              <div className="min-w-0">
                <DialogTitle className="truncate text-base">
                  {agent.displayName?.trim() || agent.id}
                </DialogTitle>
                <DialogDescription className="truncate text-xs">
                  @{agent.id}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-3">
          <DetailSection
            icon={Bot}
            title={t("agentsDetailsIdentitySection")}
          >
            <DetailItem
              label={t("agentsDetailsFieldDisplayName")}
              value={agent.displayName?.trim() || agent.id}
            />
            <DetailItem
              label={t("agentsDetailsFieldId")}
              value={agent.id}
              mono
            />
            <DetailItem
              label={t("agentsDetailsFieldDescription")}
              value={agent.description?.trim() || t("agentsDetailsEmptyValue")}
              wide
            />
            <DetailItem
              label={t("agentsDetailsFieldWorkspace")}
              value={agent.workspace ?? t("agentsDetailsUnsetValue")}
              mono
              wide
            />
          </DetailSection>

          <DetailSection
            icon={Sparkles}
            title={t("agentsDetailsRuntimeSection")}
          >
            <DetailItem
              label={t("agentsDetailsFieldModel")}
              value={model.value}
              source={model.source}
            />
            <DetailItem
              label={t("agentsDetailsFieldRuntime")}
              value={runtime.value}
              source={runtime.source}
            />
            <DetailItem
              label={t("agentsDetailsFieldRuntimeConfig")}
              value={runtimeConfig.value}
              source={runtimeConfig.source}
              mono
              prewrap
            />
          </DetailSection>

          <DetailSection
            icon={Gauge}
            title={t("agentsDetailsContextSection")}
          >
            <DetailItem
              label={t("agentsDetailsFieldContextTokens")}
              value={contextTokens.value}
              source={contextTokens.source}
            />
            <DetailItem
              label={t("agentsDetailsFieldReservedContextTokens")}
              value={reservedContextTokens.value}
              source={reservedContextTokens.source}
            />
            <DetailItem
              label={t("agentsDetailsFieldMaxToolIterations")}
              value={maxToolIterations.value}
              source={maxToolIterations.source}
            />
          </DetailSection>

          <DetailSection
            icon={Brain}
            title={t("agentsDetailsBehaviorSection")}
          >
            <DetailItem
              label={t("agentsDetailsFieldThinkingDefault")}
              value={thinkingDefault.value}
              source={thinkingDefault.source}
            />
            <DetailItem
              label={t("agentsDetailsFieldModelOverrides")}
              value={models.value}
              source={models.source}
              mono
              prewrap
            />
            <DetailItem
              label={t("agentsDetailsFieldAvatar")}
              value={agent.avatar ?? t("agentsDetailsUnsetValue")}
              mono
            />
          </DetailSection>
        </div>
        <DialogFooter className="shrink-0 px-5 pb-4 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            className="px-4"
            onClick={() => onEdit(agent)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            {t("agentsDetailsEditAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DetailSource = "default" | "override";

type ResolvedValue = {
  value: string;
  source: DetailSource;
};

function resolveTextValue(
  agentValue: string | undefined,
  defaultValue: string | undefined,
): ResolvedValue {
  const normalizedAgentValue = agentValue?.trim();
  if (normalizedAgentValue) {
    return { value: normalizedAgentValue, source: "override" };
  }
  return {
    value: defaultValue?.trim() || t("agentsDetailsUnsetValue"),
    source: "default",
  };
}

function resolveNumberValue(
  agentValue: number | undefined,
  defaultValue: number | undefined,
): ResolvedValue {
  if (typeof agentValue === "number") {
    return { value: numberFormatter.format(agentValue), source: "override" };
  }
  return {
    value:
      typeof defaultValue === "number"
        ? numberFormatter.format(defaultValue)
        : t("agentsDetailsUnsetValue"),
    source: "default",
  };
}

function resolveRuntimeValue(params: {
  agent: AgentProfileView;
  defaults?: AgentDefaultsView;
  runtimeOptions: { value: string; label: string }[];
  defaultRuntime: string;
  defaultRuntimeLabel: string;
}): ResolvedValue {
  const { agent, defaults, runtimeOptions, defaultRuntime, defaultRuntimeLabel } =
    params;
  const runtime = agent.runtime?.trim() || agent.engine?.trim();
  if (runtime) {
    return {
      value: resolveRuntimeLabel(runtime, runtimeOptions, defaultRuntimeLabel),
      source: "override",
    };
  }
  const inheritedRuntime = defaults?.engine?.trim() || defaultRuntime;
  return {
    value: inheritedRuntime
      ? resolveRuntimeLabel(inheritedRuntime, runtimeOptions, defaultRuntimeLabel)
      : defaultRuntimeLabel,
    source: "default",
  };
}

function resolveRuntimeLabel(
  value: string,
  runtimeOptions: { value: string; label: string }[],
  defaultRuntimeLabel: string,
): string {
  const normalized = normalizeSessionType(value);
  if (!normalized) {
    return defaultRuntimeLabel;
  }
  return (
    runtimeOptions.find((option) => option.value === normalized)?.label ??
    resolveSessionTypeLabel(normalized)
  );
}

function resolveRecordValue(
  agentValue: Record<string, unknown> | undefined,
  defaultValue: Record<string, unknown> | undefined,
): ResolvedValue {
  if (isNonEmptyRecord(agentValue)) {
    return { value: JSON.stringify(agentValue, null, 2), source: "override" };
  }
  return {
    value: isNonEmptyRecord(defaultValue)
      ? JSON.stringify(defaultValue, null, 2)
      : t("agentsDetailsUnsetValue"),
    source: "default",
  };
}

function isNonEmptyRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length > 0,
  );
}

function DetailSection(props: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  const { icon: Icon, title, children } = props;

  return (
    <section className="space-y-2 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold leading-5 text-gray-900">
        <Icon className="h-3.5 w-3.5 text-gray-400" />
        {title}
      </h3>
      <dl className="grid min-w-0 gap-x-6 gap-y-2.5 pl-5 sm:grid-cols-2">
        {children}
      </dl>
    </section>
  );
}

function DetailItem(props: {
  label: string;
  value: string;
  source?: DetailSource;
  mono?: boolean;
  prewrap?: boolean;
  wide?: boolean;
}) {
  const {
    label,
    value,
    source,
    mono = false,
    prewrap = false,
    wide = false,
  } = props;

  const isStructuredValue = prewrap && value.trim().startsWith("{");
  const shouldUseMono = mono && (!prewrap || isStructuredValue);

  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[10rem_minmax(0,1fr)] items-baseline gap-x-2",
        (wide || isStructuredValue) && "sm:col-span-2",
      )}
    >
      <dt className="flex min-w-0 items-baseline leading-5">
        <span className="whitespace-nowrap text-xs font-medium text-gray-500">
          {label}
        </span>
      </dt>
      <dd
        className={cn(
          "min-w-0 break-words text-xs leading-5 text-gray-900",
          isStructuredValue
            ? "max-h-28 overflow-auto whitespace-pre-wrap rounded bg-gray-50/70 px-2 py-1.5 text-left"
            : "",
        )}
      >
        <span className={shouldUseMono ? "font-mono" : undefined}>
          {value}
        </span>
        {source ? <SourceBadge source={source} /> : null}
      </dd>
    </div>
  );
}

function SourceBadge({ source }: { source: DetailSource }) {
  return (
    <span
      className={cn(
        "ml-1 whitespace-nowrap text-xs font-normal leading-5",
        source === "override" ? "text-blue-500" : "text-gray-400",
      )}
    >
      （{source === "override"
        ? t("agentsDetailsAgentOverride")
        : t("agentsDetailsInheritedDefault")}）
    </span>
  );
}
