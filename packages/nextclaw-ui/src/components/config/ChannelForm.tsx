import { useEffect, useState } from 'react';
import { useConfig, useUpdateChannel } from '@/hooks/useConfig';
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
import { MessageCircle, Settings, ToggleLeft, Hash, Mail, Globe, KeyRound } from 'lucide-react';

// Field icon mapping
const getFieldIcon = (fieldName: string) => {
  if (fieldName.includes('token') || fieldName.includes('secret') || fieldName.includes('password')) {
    return <KeyRound className="h-3.5 w-3.5 text-[hsl(30,8%,45%)]" />;
  }
  if (fieldName.includes('url') || fieldName.includes('host')) {
    return <Globe className="h-3.5 w-3.5 text-[hsl(30,8%,45%)]" />;
  }
  if (fieldName.includes('email') || fieldName.includes('mail')) {
    return <Mail className="h-3.5 w-3.5 text-[hsl(30,8%,45%)]" />;
  }
  if (fieldName.includes('id') || fieldName.includes('from')) {
    return <Hash className="h-3.5 w-3.5 text-[hsl(30,8%,45%)]" />;
  }
  if (fieldName === 'enabled' || fieldName === 'consentGranted') {
    return <ToggleLeft className="h-3.5 w-3.5 text-[hsl(30,8%,45%)]" />;
  }
  return <Settings className="h-3.5 w-3.5 text-[hsl(30,8%,45%)]" />;
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
    { name: 'secret', type: 'password', label: t('secret') },
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
  const updateChannel = useUpdateChannel();

  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const channelName = channelModal.channel;
  const channelConfig = channelName ? config?.channels[channelName] : null;
  const fields = channelName ? CHANNEL_FIELDS[channelName] : [];

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
              <DialogTitle className="capitalize">{channelName}</DialogTitle>
              <DialogDescription>配置消息渠道参数</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
          <form onSubmit={handleSubmit} className="space-y-5 pr-2">
            {fields.map((field) => (
              <div key={field.name} className="space-y-2.5">
                <Label 
                  htmlFor={field.name}
                  className="text-sm font-medium text-[hsl(30,20%,12%)] flex items-center gap-2"
                >
                  {getFieldIcon(field.name)}
                  {field.label}
                </Label>

                {field.type === 'boolean' && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[hsl(40,20%,96%)]">
                    <span className="text-sm text-[hsl(30,8%,45%)]">
                      {(formData[field.name] as boolean) ? '已启用' : '已禁用'}
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
                    className="rounded-xl border-[hsl(40,20%,90%)] bg-[hsl(40,20%,98%)] focus:bg-white"
                  />
                )}

                {field.type === 'password' && (
                  <Input
                    id={field.name}
                    type="password"
                    value={(formData[field.name] as string) || ''}
                    onChange={(e) => updateField(field.name, e.target.value)}
                    placeholder="留空保持不变"
                    className="rounded-xl border-[hsl(40,20%,90%)] bg-[hsl(40,20%,98%)] focus:bg-white"
                  />
                )}

                {field.type === 'number' && (
                  <Input
                    id={field.name}
                    type="number"
                    value={(formData[field.name] as number) || 0}
                    onChange={(e) => updateField(field.name, parseInt(e.target.value) || 0)}
                    className="rounded-xl border-[hsl(40,20%,90%)] bg-[hsl(40,20%,98%)] focus:bg-white"
                  />
                )}

                {field.type === 'tags' && (
                  <TagInput
                    value={(formData[field.name] as string[]) || []}
                    onChange={(tags) => updateField(field.name, tags)}
                  />
                )}
              </div>
            ))}

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeChannelModal}
                className="rounded-xl border-[hsl(40,20%,90%)] bg-white hover:bg-[hsl(40,20%,96%)]"
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={updateChannel.isPending}
                className="rounded-xl bg-gradient-to-r from-orange-400 to-amber-500 hover:from-orange-500 hover:to-amber-600 text-white border-0"
              >
                {updateChannel.isPending ? '保存中...' : t('save')}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
