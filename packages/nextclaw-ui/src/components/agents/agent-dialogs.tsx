import { useState } from "react";
import type { AgentProfileView } from "@/api/types";
import {
  normalizeSessionType,
  resolveSessionTypeLabel,
  type ChatSessionTypeOption,
} from "@/components/chat/useChatSessionTypeState";
import { ProviderScopedModelInput } from "@/components/common/ProviderScopedModelInput";
import { Button } from "@/components/ui/button";
import { NoticeCard } from "@/components/ui/notice-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/lib/i18n";
import type { ProviderModelCatalogItem } from "@/lib/provider-models";
import { Pencil, Plus } from "lucide-react";

export type AgentCreateFormState = {
  id: string;
  displayName: string;
  description: string;
  avatar: string;
  home: string;
  model: string;
  runtime: string;
};

export type AgentEditFormState = {
  displayName: string;
  description: string;
  avatar: string;
  model: string;
  runtime: string;
};

export const EMPTY_AGENT_CREATE_FORM: AgentCreateFormState = {
  id: "",
  displayName: "",
  description: "",
  avatar: "",
  model: "",
  home: "",
  runtime: "",
};

export const EMPTY_AGENT_EDIT_FORM: AgentEditFormState = {
  displayName: "",
  description: "",
  avatar: "",
  model: "",
  runtime: "",
};

export function toAgentEditFormState(
  agent: AgentProfileView,
): AgentEditFormState {
  return {
    displayName: agent.displayName ?? "",
    description: agent.description ?? "",
    avatar: agent.avatar ?? "",
    model: agent.model ?? "",
    runtime: agent.runtime ?? agent.engine ?? "",
  };
}

function buildRuntimeSelectOptions(params: {
  runtimeOptions: ChatSessionTypeOption[];
  currentRuntime: string;
}): ChatSessionTypeOption[] {
  const { runtimeOptions, currentRuntime: rawCurrentRuntime } = params;
  const currentRuntime = rawCurrentRuntime.trim();
  if (!currentRuntime) {
    return runtimeOptions;
  }
  const normalizedCurrentRuntime = normalizeSessionType(currentRuntime);
  if (
    runtimeOptions.some((option) => option.value === normalizedCurrentRuntime)
  ) {
    return runtimeOptions;
  }
  return [
    ...runtimeOptions,
    {
      value: normalizedCurrentRuntime,
      label: resolveSessionTypeLabel(normalizedCurrentRuntime),
      ready: false,
      reason: "unavailable",
      reasonMessage: null,
      supportedModels: undefined,
      recommendedModel: null,
      cta: null,
    },
  ].sort((left, right) => {
    if (left.value === "native") {
      return -1;
    }
    if (right.value === "native") {
      return 1;
    }
    return left.value.localeCompare(right.value);
  });
}

type AgentRuntimeSelectFieldProps = {
  value: string;
  disabled?: boolean;
  runtimeOptions: ChatSessionTypeOption[];
  defaultRuntime: string;
  onChange: (value: string) => void;
};

function AgentRuntimeSelectField({
  value,
  disabled = false,
  runtimeOptions,
  defaultRuntime,
  onChange,
}: AgentRuntimeSelectFieldProps) {
  const normalizedValue = value.trim() ? normalizeSessionType(value) : "";
  const selectOptions = buildRuntimeSelectOptions({
    runtimeOptions,
    currentRuntime: value,
  });
  const selectedRuntimeOption =
    selectOptions.find((option) => option.value === normalizedValue) ?? null;
  const helperText =
    selectedRuntimeOption?.reasonMessage?.trim() ||
    (selectedRuntimeOption?.ready === false
      ? t("agentsRuntimeUnavailableHelp")
      : "");

  return (
    <div className="space-y-2">
      <Select
        value={normalizedValue || defaultRuntime}
        onValueChange={(nextValue) =>
          onChange(nextValue === defaultRuntime ? "" : nextValue)
        }
        disabled={disabled}
      >
        <SelectTrigger
          aria-label={t("agentsCardRuntimeLabel")}
          className="rounded-xl"
        >
          <SelectValue placeholder={t("agentsRuntimeSelectPlaceholder")} />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {selectOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={
                option.ready === false && option.value !== normalizedValue
              }
              className="rounded-lg"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {helperText ? (
        <p className="text-xs text-gray-500">{helperText}</p>
      ) : null}
    </div>
  );
}

type AgentCreateDialogProps = {
  open: boolean;
  pending: boolean;
  providerCatalog: ProviderModelCatalogItem[];
  runtimeOptions: ChatSessionTypeOption[];
  defaultRuntime: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: AgentCreateFormState) => Promise<void> | void;
};

export function AgentCreateDialog({
  open,
  pending,
  providerCatalog,
  runtimeOptions,
  defaultRuntime,
  onOpenChange,
  onSubmit,
}: AgentCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open || pending ? (
        <AgentCreateDialogContent
          key={open ? "create-open" : "create-closed"}
          pending={pending}
          providerCatalog={providerCatalog}
          runtimeOptions={runtimeOptions}
          defaultRuntime={defaultRuntime}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
        />
      ) : null}
    </Dialog>
  );
}

type AgentEditDialogProps = {
  agent: AgentProfileView | null;
  pending: boolean;
  providerCatalog: ProviderModelCatalogItem[];
  runtimeOptions: ChatSessionTypeOption[];
  defaultRuntime: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (agentId: string, form: AgentEditFormState) => Promise<void> | void;
};

export function AgentEditDialog({
  agent,
  pending,
  providerCatalog,
  runtimeOptions,
  defaultRuntime,
  onOpenChange,
  onSubmit,
}: AgentEditDialogProps) {
  return (
    <Dialog open={agent !== null} onOpenChange={onOpenChange}>
      {agent ? (
        <AgentEditDialogContent
          key={agent.id}
          agent={agent}
          pending={pending}
          providerCatalog={providerCatalog}
          runtimeOptions={runtimeOptions}
          defaultRuntime={defaultRuntime}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
        />
      ) : null}
    </Dialog>
  );
}

function AgentCreateDialogContent(props: {
  pending: boolean;
  providerCatalog: ProviderModelCatalogItem[];
  runtimeOptions: ChatSessionTypeOption[];
  defaultRuntime: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: AgentCreateFormState) => Promise<void> | void;
}) {
  const {
    pending,
    providerCatalog,
    runtimeOptions,
    defaultRuntime,
    onOpenChange,
    onSubmit,
  } = props;
  const [form, setForm] = useState<AgentCreateFormState>(
    EMPTY_AGENT_CREATE_FORM,
  );

  return (
    <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden border-none bg-[linear-gradient(180deg,#fff9f1_0%,#ffffff_24%)] p-0 sm:max-h-[760px] sm:max-w-xl">
      <div className="shrink-0 border-b border-[#f0e2c8] px-6 py-6">
        <DialogHeader className="text-left">
          <DialogTitle>{t("agentsCreateDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("agentsCreateDialogDescription")}
          </DialogDescription>
        </DialogHeader>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              value={form.id}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, id: event.target.value }))
              }
              placeholder={t("agentsFormIdPlaceholder")}
            />
            <Input
              value={form.displayName}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  displayName: event.target.value,
                }))
              }
              placeholder={t("agentsFormNamePlaceholder")}
            />
            <Textarea
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder={t("agentsFormDescriptionPlaceholder")}
              rows={4}
              className="md:col-span-2"
            />
            <Input
              value={form.avatar}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, avatar: event.target.value }))
              }
              placeholder={t("agentsFormAvatarPlaceholder")}
            />
            <Input
              value={form.home}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, home: event.target.value }))
              }
              placeholder={t("agentsFormHomePlaceholder")}
            />
            <ProviderScopedModelInput
              value={form.model}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, model: value }))
              }
              providerCatalog={providerCatalog}
              disabled={pending}
              className="md:col-span-2"
            />
            <AgentRuntimeSelectField
              value={form.runtime}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, runtime: value }))
              }
              runtimeOptions={runtimeOptions}
              defaultRuntime={defaultRuntime}
              disabled={pending}
            />
          </div>
          <NoticeCard
            tone="warning"
            title={t("agentsCreateDialogHint")}
            className="text-xs leading-6"
          />
        </div>
      </div>
      <DialogFooter className="shrink-0 border-t border-[#f1e7d4] px-6 py-5">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          disabled={pending}
        >
          {t("cancel")}
        </Button>
        <Button
          type="button"
          variant="primary"
          className="rounded-2xl px-5"
          onClick={() => void onSubmit(form)}
          disabled={pending || form.id.trim().length === 0}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("agentsCreateAction")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AgentEditDialogContent(props: {
  agent: AgentProfileView;
  pending: boolean;
  providerCatalog: ProviderModelCatalogItem[];
  runtimeOptions: ChatSessionTypeOption[];
  defaultRuntime: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (agentId: string, form: AgentEditFormState) => Promise<void> | void;
}) {
  const {
    agent,
    pending,
    providerCatalog,
    runtimeOptions,
    defaultRuntime,
    onOpenChange,
    onSubmit,
  } = props;
  const [form, setForm] = useState<AgentEditFormState>(
    toAgentEditFormState(agent),
  );

  return (
    <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden border-none bg-[linear-gradient(180deg,#fff9f1_0%,#ffffff_24%)] p-0 sm:max-h-[760px] sm:max-w-xl">
      <div className="shrink-0 border-b border-[#f0e2c8] px-6 py-6">
        <DialogHeader className="text-left">
          <DialogTitle>{t("agentsEditDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("agentsEditDialogDescription")}
          </DialogDescription>
        </DialogHeader>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">
        <div className="space-y-4">
          <NoticeCard
            tone="warning"
            title={t("agentsEditHomeReadonly")}
            description={t("agentsEditHomeReadonlyHint")}
          >
            <div className="break-all text-sm text-amber-950">
              {agent.workspace ?? "-"}
            </div>
          </NoticeCard>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              value={form.displayName}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  displayName: event.target.value,
                }))
              }
              placeholder={t("agentsFormNamePlaceholder")}
            />
            <Textarea
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder={t("agentsFormDescriptionPlaceholder")}
              rows={4}
              className="md:col-span-2"
            />
            <Input
              value={form.avatar}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, avatar: event.target.value }))
              }
              placeholder={t("agentsFormAvatarPlaceholder")}
            />
            <ProviderScopedModelInput
              value={form.model}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, model: value }))
              }
              providerCatalog={providerCatalog}
              disabled={pending}
              className="md:col-span-2"
            />
            <AgentRuntimeSelectField
              value={form.runtime}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, runtime: value }))
              }
              runtimeOptions={runtimeOptions}
              defaultRuntime={defaultRuntime}
              disabled={pending}
            />
          </div>
        </div>
      </div>
      <DialogFooter className="shrink-0 border-t border-[#f1e7d4] px-6 py-5">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          disabled={pending}
        >
          {t("cancel")}
        </Button>
        <Button
          type="button"
          variant="primary"
          className="rounded-2xl px-5"
          onClick={() => onSubmit(agent.id, form)}
          disabled={pending}
        >
          <Pencil className="mr-2 h-4 w-4" />
          {t("agentsEditSaveAction")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
