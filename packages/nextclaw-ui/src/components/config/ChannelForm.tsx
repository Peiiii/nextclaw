import { useEffect, useState } from 'react';
import { useConfig, useConfigSchema, useUpdateChannel } from '@/hooks/useConfig';
import { probeFeishu } from '@/api/config';
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
const CHANNEL_FIELDS: Record<string, Array<{ name: string; type: string; label: string }>> = {
  telegram: [
    { name: 'enabled', type: 'boolean', label: t('enabled') },
    { name: 'token', type: 'password', label: t('botToken') },
    { name: 'allowFrom', type: 'tags', label: t('allowFrom') },
    { name: 'proxy', type: 'text', label: t('proxy') }
  ],
  discord: [
    { name: 'enabled', type: 'boolean', label: t('enabled') },
    { name: 'token', type: 'password', label: t('botToken') },
    { name: 'allowFrom', type: 'tags', label: t('allowFrom') },
    { name: 'gatewayUrl', type: 'text', label: t('gatewayUrl') },
    { name: 'intents', type: 'number', label: t('intents') }
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
  slack: [
    { name: 'enabled', type: 'boolean', label: t('enabled') },
    { name: 'mode', type: 'text', label: t('mode') },
    { name: 'webhookPath', type: 'text', label: t('webhookPath') },
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

export function ChannelForm() {
  const { channelModal, closeChannelModal } = useUiStore();
  const { data: config } = useConfig();
  const { data: schema } = useConfigSchema();
  const updateChannel = useUpdateChannel();

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isConnecting, setIsConnecting] = useState(false);

  const channelName = channelModal.channel;
  const channelConfig = channelName ? config?.channels[channelName] : null;
  const fields = channelName ? CHANNEL_FIELDS[channelName] : [];
  const uiHints = schema?.uiHints;
  const channelLabel = channelName
    ? hintForPath(`channels.${channelName}`, uiHints)?.label ?? channelName
    : channelName;

  useEffect(() => {
    if (channelConfig) {
      setFormData({ ...channelConfig });
    } else {
      setFormData({});
    }
  }, [channelConfig, channelName]);

  const updateField = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!channelName) return;

    updateChannel.mutate(
      { channel: channelName, data: formData },
      { onSuccess: () => closeChannelModal() }
    );
  };

  const handleVerifyConnect = async () => {
    if (!channelName || channelName !== 'feishu') return;
    setIsConnecting(true);
    try {
      const nextData = { ...formData, enabled: true };
      if (!formData.enabled) {
        setFormData(nextData);
      }
      await updateChannel.mutateAsync({ channel: channelName, data: nextData });
      const probe = await probeFeishu();
      const botLabel = probe.botName ? ` (${probe.botName})` : '';
      toast.success(t('feishuVerifySuccess') + botLabel);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`${t('feishuVerifyFailed')}: ${message}`);
    } finally {
      setIsConnecting(false);
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

        <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
          <form onSubmit={handleSubmit} className="space-y-5 pr-2">
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
                </div>
              );
            })}

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeChannelModal}
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={updateChannel.isPending || isConnecting}
              >
                {updateChannel.isPending ? 'Saving...' : t('save')}
              </Button>
              {channelName === 'feishu' && (
                <Button
                  type="button"
                  onClick={handleVerifyConnect}
                  disabled={updateChannel.isPending || isConnecting}
                  variant="secondary"
                >
                  {isConnecting ? t('feishuConnecting') : t('saveVerifyConnect')}
                </Button>
              )}
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
