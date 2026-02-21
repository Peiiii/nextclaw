import { useEffect, useMemo, useState } from 'react';
import { useConfig, useConfigSchema, useUpdateChannel, useExecuteConfigAction } from '@/hooks/useConfig';
import { useUiStore } from '@/stores/ui.store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TagInput } from '@/components/common/TagInput';
import { t } from '@/lib/i18n';
import { hintForPath } from '@/lib/config-hints';
import { toast } from 'sonner';
import { MessageCircle, Settings, ToggleLeft, Hash, Mail, Globe, KeyRound } from 'lucide-react';
import type { ConfigActionManifest } from '@/api/types';

type ChannelFieldType = 'boolean' | 'text' | 'email' | 'password' | 'number' | 'tags' | 'select' | 'json';
type ChannelOption = { value: string; label: string };
type ChannelField = { name: string; type: ChannelFieldType; label: string; options?: ChannelOption[] };

const DM_POLICY_OPTIONS: ChannelOption[] = [
  { value: 'pairing', label: 'pairing' },
  { value: 'allowlist', label: 'allowlist' },
  { value: 'open', label: 'open' },
  { value: 'disabled', label: 'disabled' }
];

const GROUP_POLICY_OPTIONS: ChannelOption[] = [
  { value: 'open', label: 'open' },
  { value: 'allowlist', label: 'allowlist' },
  { value: 'disabled', label: 'disabled' }
];

// Field icon mapping
const getFieldIcon = (fieldName: string) => {
  if (fieldName.includes('token') || fieldName.includes('secret') || fieldName.includes('password')) {
    return <KeyRound className="h-3.5 w-3.5 text-gray-500" />;
  }
  if (fieldName.includes('url') || fieldName.includes('host')) {
    return <Globe className="h-3.5 w-3.5 text-gray-500" />;
  }
  if (fieldName.includes('email') || fieldName.includes('mail')) {
    return <Mail className="h-3.5 w-3.5 text-gray-500" />;
  }
  if (fieldName.includes('id') || fieldName.includes('from')) {
    return <Hash className="h-3.5 w-3.5 text-gray-500" />;
  }
  if (fieldName === 'enabled' || fieldName === 'consentGranted') {
    return <ToggleLeft className="h-3.5 w-3.5 text-gray-500" />;
  }
  return <Settings className="h-3.5 w-3.5 text-gray-500" />;
};

// Channel field definitions
const CHANNEL_FIELDS: Record<string, ChannelField[]> = {
  telegram: [
    { name: 'enabled', type: 'boolean', label: t('enabled') },
    { name: 'token', type: 'password', label: t('botToken') },
    { name: 'allowFrom', type: 'tags', label: t('allowFrom') },
    { name: 'proxy', type: 'text', label: t('proxy') },
    { name: 'accountId', type: 'text', label: 'Account ID' },
    { name: 'dmPolicy', type: 'select', label: 'DM Policy', options: DM_POLICY_OPTIONS },
    { name: 'groupPolicy', type: 'select', label: 'Group Policy', options: GROUP_POLICY_OPTIONS },
    { name: 'groupAllowFrom', type: 'tags', label: 'Group Allow From' },
    { name: 'requireMention', type: 'boolean', label: 'Require Mention' },
    { name: 'mentionPatterns', type: 'tags', label: 'Mention Patterns' },
    { name: 'groups', type: 'json', label: 'Group Rules (JSON)' }
  ],
  discord: [
    { name: 'enabled', type: 'boolean', label: t('enabled') },
    { name: 'token', type: 'password', label: t('botToken') },
    { name: 'allowBots', type: 'boolean', label: 'Allow Bot Messages' },
    { name: 'allowFrom', type: 'tags', label: t('allowFrom') },
    { name: 'gatewayUrl', type: 'text', label: t('gatewayUrl') },
    { name: 'intents', type: 'number', label: t('intents') },
    { name: 'proxy', type: 'text', label: t('proxy') },
    { name: 'mediaMaxMb', type: 'number', label: 'Attachment Max Size (MB)' },
    { name: 'accountId', type: 'text', label: 'Account ID' },
    { name: 'dmPolicy', type: 'select', label: 'DM Policy', options: DM_POLICY_OPTIONS },
    { name: 'groupPolicy', type: 'select', label: 'Group Policy', options: GROUP_POLICY_OPTIONS },
    { name: 'groupAllowFrom', type: 'tags', label: 'Group Allow From' },
    { name: 'requireMention', type: 'boolean', label: 'Require Mention' },
    { name: 'mentionPatterns', type: 'tags', label: 'Mention Patterns' },
    { name: 'groups', type: 'json', label: 'Group Rules (JSON)' }
  ],
  whatsapp: [
    { name: 'enabled', type: 'boolean', label: t('enabled') },
    { name: 'bridgeUrl', type: 'text', label: t('bridgeUrl') },
    { name: 'allowFrom', type: 'tags', label: t('allowFrom') }
  ],
  feishu: [
    { name: 'enabled', type: 'boolean', label: t('enabled') },
    { name: 'appId', type: 'text', label: t('appId') },
    { name: 'appSecret', type: 'password', label: t('appSecret') },
    { name: 'encryptKey', type: 'password', label: t('encryptKey') },
    { name: 'verificationToken', type: 'password', label: t('verificationToken') },
    { name: 'allowFrom', type: 'tags', label: t('allowFrom') }
  ],
  dingtalk: [
    { name: 'enabled', type: 'boolean', label: t('enabled') },
    { name: 'clientId', type: 'text', label: t('clientId') },
    { name: 'clientSecret', type: 'password', label: t('clientSecret') },
    { name: 'allowFrom', type: 'tags', label: t('allowFrom') }
  ],
  wecom: [
    { name: 'enabled', type: 'boolean', label: t('enabled') },
    { name: 'corpId', type: 'text', label: t('corpId') },
    { name: 'agentId', type: 'text', label: t('agentId') },
    { name: 'secret', type: 'password', label: t('secret') },
    { name: 'token', type: 'password', label: t('token') },
    { name: 'callbackPort', type: 'number', label: t('callbackPort') },
    { name: 'callbackPath', type: 'text', label: t('callbackPath') },
    { name: 'allowFrom', type: 'tags', label: t('allowFrom') }
  ],
  slack: [
    { name: 'enabled', type: 'boolean', label: t('enabled') },
    { name: 'mode', type: 'text', label: t('mode') },
    { name: 'webhookPath', type: 'text', label: t('webhookPath') },
    { name: 'allowBots', type: 'boolean', label: 'Allow Bot Messages' },
    { name: 'botToken', type: 'password', label: t('botToken') },
    { name: 'appToken', type: 'password', label: t('appToken') }
  ],
  email: [
    { name: 'enabled', type: 'boolean', label: t('enabled') },
    { name: 'consentGranted', type: 'boolean', label: t('consentGranted') },
    { name: 'imapHost', type: 'text', label: t('imapHost') },
    { name: 'imapPort', type: 'number', label: t('imapPort') },
    { name: 'imapUsername', type: 'text', label: t('imapUsername') },
    { name: 'imapPassword', type: 'password', label: t('imapPassword') },
    { name: 'fromAddress', type: 'email', label: t('fromAddress') }
  ],
  mochat: [
    { name: 'enabled', type: 'boolean', label: t('enabled') },
    { name: 'baseUrl', type: 'text', label: t('baseUrl') },
    { name: 'clawToken', type: 'password', label: t('clawToken') },
    { name: 'agentUserId', type: 'text', label: t('agentUserId') },
    { name: 'allowFrom', type: 'tags', label: t('allowFrom') }
  ],
  qq: [
    { name: 'enabled', type: 'boolean', label: t('enabled') },
    { name: 'appId', type: 'text', label: t('appId') },
    { name: 'secret', type: 'password', label: t('appSecret') },
    { name: 'markdownSupport', type: 'boolean', label: t('markdownSupport') },
    { name: 'allowFrom', type: 'tags', label: t('allowFrom') }
  ]
};

const channelIcons: Record<string, typeof MessageCircle> = {
  telegram: MessageCircle,
  slack: MessageCircle,
  email: Mail,
  default: MessageCircle
};

const channelColors: Record<string, string> = {
  telegram: 'from-sky-400 to-blue-500',
  slack: 'from-purple-400 to-indigo-500',
  email: 'from-rose-400 to-pink-500',
  default: 'from-slate-400 to-gray-500'
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMergeRecords(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const prev = next[key];
    if (isRecord(prev) && isRecord(value)) {
      next[key] = deepMergeRecords(prev, value);
      continue;
    }
    next[key] = value;
  }
  return next;
}

function buildScopeDraft(scope: string, value: Record<string, unknown>): Record<string, unknown> {
  const segments = scope.split('.');
  const output: Record<string, unknown> = {};
  let cursor: Record<string, unknown> = output;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    cursor[segment] = {};
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]] = value;
  return output;
}

export function ChannelForm() {
  const { channelModal, closeChannelModal } = useUiStore();
  const { data: config } = useConfig();
  const { data: schema } = useConfigSchema();
  const updateChannel = useUpdateChannel();
  const executeAction = useExecuteConfigAction();

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>({});
  const [runningActionId, setRunningActionId] = useState<string | null>(null);

  const channelName = channelModal.channel;
  const channelConfig = channelName ? config?.channels[channelName] : null;
  const fields = useMemo(() => (channelName ? CHANNEL_FIELDS[channelName] : []), [channelName]);
  const uiHints = schema?.uiHints;
  const scope = channelName ? `channels.${channelName}` : null;
  const actions = schema?.actions?.filter((action) => action.scope === scope) ?? [];
  const channelLabel = channelName
    ? hintForPath(`channels.${channelName}`, uiHints)?.label ?? channelName
    : channelName;

  useEffect(() => {
    if (channelConfig) {
      setFormData({ ...channelConfig });
      const nextDrafts: Record<string, string> = {};
      fields
        .filter((field) => field.type === 'json')
        .forEach((field) => {
          const value = channelConfig[field.name];
          nextDrafts[field.name] = JSON.stringify(value ?? {}, null, 2);
        });
      setJsonDrafts(nextDrafts);
    } else {
      setFormData({});
      setJsonDrafts({});
    }
  }, [channelConfig, channelName, fields]);

  const updateField = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!channelName) return;

    const payload: Record<string, unknown> = { ...formData };
    for (const field of fields) {
      if (field.type !== 'json') {
        continue;
      }
      const raw = jsonDrafts[field.name] ?? '';
      try {
        payload[field.name] = raw.trim() ? JSON.parse(raw) : {};
      } catch {
        toast.error(`Invalid JSON for ${field.name}`);
        return;
      }
    }

    updateChannel.mutate(
      { channel: channelName, data: payload },
      { onSuccess: () => closeChannelModal() }
    );
  };

  const applyActionPatchToForm = (patch?: Record<string, unknown>) => {
    if (!patch || !channelName) {
      return;
    }
    const channelsNode = patch.channels;
    if (!isRecord(channelsNode)) {
      return;
    }
    const channelPatch = channelsNode[channelName];
    if (!isRecord(channelPatch)) {
      return;
    }
    setFormData((prev) => deepMergeRecords(prev, channelPatch));
  };

  const handleManualAction = async (action: ConfigActionManifest) => {
    if (!channelName || !scope) {
      return;
    }

    setRunningActionId(action.id);
    try {
      let nextData = { ...formData };

      if (action.saveBeforeRun) {
        nextData = {
          ...nextData,
          ...(action.savePatch ?? {})
        };
        setFormData(nextData);
        await updateChannel.mutateAsync({ channel: channelName, data: nextData });
      }

      const result = await executeAction.mutateAsync({
        actionId: action.id,
        data: {
          scope,
          draftConfig: buildScopeDraft(scope, nextData)
        }
      });

      applyActionPatchToForm(result.patch);

      if (result.ok) {
        toast.success(result.message || t('success'));
      } else {
        toast.error(result.message || t('error'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`${t('error')}: ${message}`);
    } finally {
      setRunningActionId(null);
    }
  };

  const Icon = channelIcons[channelName || ''] || channelIcons.default;
  const gradientClass = channelColors[channelName || ''] || channelColors.default;

  return (
    <Dialog open={channelModal.open} onOpenChange={closeChannelModal}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="capitalize">{channelLabel}</DialogTitle>
              <DialogDescription>Configure message channel parameters</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar py-2 pr-2 space-y-5">
            {fields.map((field) => {
              const hint = channelName
                ? hintForPath(`channels.${channelName}.${field.name}`, uiHints)
                : undefined;
              const label = hint?.label ?? field.label;
              const placeholder = hint?.placeholder;

              return (
                <div key={field.name} className="space-y-2.5">
                  <Label
                    htmlFor={field.name}
                    className="text-sm font-medium text-gray-900 flex items-center gap-2"
                  >
                    {getFieldIcon(field.name)}
                    {label}
                  </Label>

                  {field.type === 'boolean' && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                      <span className="text-sm text-gray-500">
                        {(formData[field.name] as boolean) ? t('enabled') : t('disabled')}
                      </span>
                      <Switch
                        id={field.name}
                        checked={(formData[field.name] as boolean) || false}
                        onCheckedChange={(checked) => updateField(field.name, checked)}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                    </div>
                  )}

                  {(field.type === 'text' || field.type === 'email') && (
                    <Input
                      id={field.name}
                      type={field.type}
                      value={(formData[field.name] as string) || ''}
                      onChange={(e) => updateField(field.name, e.target.value)}
                      placeholder={placeholder}
                      className="rounded-xl"
                    />
                  )}

                  {field.type === 'password' && (
                    <Input
                      id={field.name}
                      type="password"
                      value={(formData[field.name] as string) || ''}
                      onChange={(e) => updateField(field.name, e.target.value)}
                      placeholder={placeholder ?? 'Leave blank to keep unchanged'}
                      className="rounded-xl"
                    />
                  )}

                  {field.type === 'number' && (
                    <Input
                      id={field.name}
                      type="number"
                      value={(formData[field.name] as number) || 0}
                      onChange={(e) => updateField(field.name, parseInt(e.target.value) || 0)}
                      placeholder={placeholder}
                      className="rounded-xl"
                    />
                  )}

                  {field.type === 'tags' && (
                    <TagInput
                      value={(formData[field.name] as string[]) || []}
                      onChange={(tags) => updateField(field.name, tags)}
                    />
                  )}

                  {field.type === 'select' && (
                    <select
                      id={field.name}
                      value={(formData[field.name] as string) || ''}
                      onChange={(e) => updateField(field.name, e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                    >
                      {(field.options ?? []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.type === 'json' && (
                    <textarea
                      id={field.name}
                      value={jsonDrafts[field.name] ?? '{}'}
                      onChange={(event) =>
                        setJsonDrafts((prev) => ({
                          ...prev,
                          [field.name]: event.target.value
                        }))
                      }
                      className="min-h-[120px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-mono"
                    />
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter className="pt-4 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={closeChannelModal}
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={updateChannel.isPending || Boolean(runningActionId)}
            >
              {updateChannel.isPending ? 'Saving...' : t('save')}
            </Button>
            {actions
              .filter((action) => action.trigger === 'manual')
              .map((action) => (
                <Button
                  key={action.id}
                  type="button"
                  onClick={() => handleManualAction(action)}
                  disabled={updateChannel.isPending || Boolean(runningActionId)}
                  variant="secondary"
                >
                  {runningActionId === action.id ? t('connecting') : action.title}
                </Button>
              ))}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
