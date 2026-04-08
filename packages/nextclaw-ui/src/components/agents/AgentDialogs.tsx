import { useEffect, useState } from 'react';
import type { AgentProfileView } from '@/api/types';
import { normalizeSessionType, resolveSessionTypeLabel, type ChatSessionTypeOption } from '@/components/chat/useChatSessionTypeState';
import { ProviderScopedModelInput } from '@/components/common/ProviderScopedModelInput';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { t } from '@/lib/i18n';
import type { ProviderModelCatalogItem } from '@/lib/provider-models';
import { Pencil, Plus } from 'lucide-react';

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
  id: '',
  displayName: '',
  description: '',
  avatar: '',
  model: '',
  home: '',
  runtime: ''
};

export const EMPTY_AGENT_EDIT_FORM: AgentEditFormState = {
  displayName: '',
  description: '',
  avatar: '',
  model: '',
  runtime: ''
};

export function toAgentEditFormState(agent: AgentProfileView): AgentEditFormState {
  return {
    displayName: agent.displayName ?? '',
    description: agent.description ?? '',
    avatar: agent.avatar ?? '',
    model: agent.model ?? '',
    runtime: agent.runtime ?? agent.engine ?? ''
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
  if (runtimeOptions.some((option) => option.value === normalizedCurrentRuntime)) {
    return runtimeOptions;
  }
  return [
    ...runtimeOptions,
    {
      value: normalizedCurrentRuntime,
      label: resolveSessionTypeLabel(normalizedCurrentRuntime),
      ready: false,
      reason: 'unavailable',
      reasonMessage: null,
      supportedModels: undefined,
      recommendedModel: null,
      cta: null
    }
  ].sort((left, right) => {
    if (left.value === 'native') {
      return -1;
    }
    if (right.value === 'native') {
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
  onChange
}: AgentRuntimeSelectFieldProps) {
  const normalizedValue = value.trim() ? normalizeSessionType(value) : '';
  const selectOptions = buildRuntimeSelectOptions({
    runtimeOptions,
    currentRuntime: value
  });
  const selectedRuntimeOption = selectOptions.find((option) => option.value === normalizedValue) ?? null;
  const helperText =
    selectedRuntimeOption?.reasonMessage?.trim() ||
    (selectedRuntimeOption?.ready === false ? t('agentsRuntimeUnavailableHelp') : '');

  return (
    <div className="space-y-2">
      <Select
        value={normalizedValue || defaultRuntime}
        onValueChange={(nextValue) => onChange(nextValue === defaultRuntime ? '' : nextValue)}
        disabled={disabled}
      >
        <SelectTrigger aria-label={t('agentsCardRuntimeLabel')} className="rounded-xl">
          <SelectValue placeholder={t('agentsRuntimeSelectPlaceholder')} />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {selectOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.ready === false && option.value !== normalizedValue}
              className="rounded-lg"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {helperText ? <p className="text-xs text-gray-500">{helperText}</p> : null}
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
  onSubmit
}: AgentCreateDialogProps) {
  const [form, setForm] = useState<AgentCreateFormState>(EMPTY_AGENT_CREATE_FORM);

  useEffect(() => {
    if (open || pending) {
      return;
    }
    setForm(EMPTY_AGENT_CREATE_FORM);
  }, [open, pending]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden border-none bg-[linear-gradient(180deg,#fff9f1_0%,#ffffff_24%)] p-0 sm:max-h-[760px] sm:max-w-xl">
        <div className="shrink-0 border-b border-[#f0e2c8] px-6 py-6">
          <DialogHeader className="text-left">
            <DialogTitle>{t('agentsCreateDialogTitle')}</DialogTitle>
            <DialogDescription>{t('agentsCreateDialogDescription')}</DialogDescription>
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
              placeholder={t('agentsFormIdPlaceholder')}
            />
            <Input
              value={form.displayName}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  displayName: event.target.value
                }))
              }
              placeholder={t('agentsFormNamePlaceholder')}
            />
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value
                }))
              }
              placeholder={t('agentsFormDescriptionPlaceholder')}
              rows={4}
              className="min-h-28 rounded-xl border border-gray-200/80 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40 md:col-span-2"
            />
            <Input
              value={form.avatar}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, avatar: event.target.value }))
              }
              placeholder={t('agentsFormAvatarPlaceholder')}
            />
            <Input
              value={form.home}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, home: event.target.value }))
              }
              placeholder={t('agentsFormHomePlaceholder')}
            />
            <ProviderScopedModelInput
              value={form.model}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, model: value }))
              }
              providerCatalog={providerCatalog}
              disabled={pending}
              modelPlaceholder="gpt-5.1"
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
          <div className="rounded-2xl border border-[#efe3ca] bg-[#fff9ef] px-4 py-3 text-xs leading-6 text-[#7a6246]">
            {t('agentsCreateDialogHint')}
          </div>
          </div>
        </div>
        <DialogFooter className="shrink-0 border-t border-[#f1e7d4] px-6 py-5">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            className="rounded-2xl bg-[#1f5c4d] px-5 text-white hover:bg-[#184d40]"
            onClick={() => void onSubmit(form)}
            disabled={pending || form.id.trim().length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('agentsCreateAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
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
  onSubmit
}: AgentEditDialogProps) {
  const [form, setForm] = useState<AgentEditFormState>(EMPTY_AGENT_EDIT_FORM);

  useEffect(() => {
    if (!agent) {
      setForm(EMPTY_AGENT_EDIT_FORM);
      return;
    }
    setForm(toAgentEditFormState(agent));
  }, [agent]);

  return (
    <Dialog open={agent !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden border-none bg-[linear-gradient(180deg,#fff9f1_0%,#ffffff_24%)] p-0 sm:max-h-[760px] sm:max-w-xl">
        <div className="shrink-0 border-b border-[#f0e2c8] px-6 py-6">
          <DialogHeader className="text-left">
            <DialogTitle>{t('agentsEditDialogTitle')}</DialogTitle>
            <DialogDescription>{t('agentsEditDialogDescription')}</DialogDescription>
          </DialogHeader>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">
          <div className="space-y-4">
          <div className="rounded-2xl border border-[#efe3ca] bg-[#fff9ef] px-4 py-3 text-xs leading-6 text-[#7a6246]">
            <div className="font-semibold uppercase tracking-[0.16em] text-[#9b6118]">
              {t('agentsEditHomeReadonly')}
            </div>
            <div className="mt-1 break-all text-sm text-[#3f3323]">
              {agent?.workspace ?? '-'}
            </div>
            <div className="mt-1 text-[11px] text-[#8d7456]">
              {t('agentsEditHomeReadonlyHint')}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              value={form.displayName}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  displayName: event.target.value
                }))
              }
              placeholder={t('agentsFormNamePlaceholder')}
            />
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value
                }))
              }
              placeholder={t('agentsFormDescriptionPlaceholder')}
              rows={4}
              className="min-h-28 rounded-xl border border-gray-200/80 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40 md:col-span-2"
            />
            <Input
              value={form.avatar}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, avatar: event.target.value }))
              }
              placeholder={t('agentsFormAvatarPlaceholder')}
            />
            <ProviderScopedModelInput
              value={form.model}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, model: value }))
              }
              providerCatalog={providerCatalog}
              disabled={pending}
              modelPlaceholder="gpt-5.1"
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
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            className="rounded-2xl bg-[#1f5c4d] px-5 text-white hover:bg-[#184d40]"
            onClick={() => agent && onSubmit(agent.id, form)}
            disabled={pending || agent === null}
          >
            <Pencil className="mr-2 h-4 w-4" />
            {t('agentsEditSaveAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
