import { useEffect, useState } from 'react';
import { useConfig, useUpdateChannel } from '@/hooks/useConfig';
import { useUiStore } from '@/stores/ui.store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TagInput } from '@/components/common/TagInput';
import { t } from '@/lib/i18n';
import type { ChannelConfigUpdate } from '@/api/types';
import { ScrollArea } from '@/components/ui/scroll-area';

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

  if (!channelModal.open || !channelName) return null;

  return (
    <Dialog open={channelModal.open} onOpenChange={closeChannelModal}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="capitalize">{channelName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4 pr-2">
            {fields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>{field.label}</Label>

                {field.type === 'boolean' && (
                  <Switch
                    id={field.name}
                    checked={(formData[field.name] as boolean) || false}
                    onCheckedChange={(checked) => updateField(field.name, checked)}
                  />
                )}

                {field.type === 'text' && (
                  <Input
                    id={field.name}
                    type="text"
                    value={(formData[field.name] as string) || ''}
                    onChange={(e) => updateField(field.name, e.target.value)}
                  />
                )}

                {field.type === 'password' && (
                  <Input
                    id={field.name}
                    type="password"
                    value={(formData[field.name] as string) || ''}
                    onChange={(e) => updateField(field.name, e.target.value)}
                    placeholder="留空保持不变"
                  />
                )}

                {field.type === 'number' && (
                  <Input
                    id={field.name}
                    type="number"
                    value={(formData[field.name] as number) || 0}
                    onChange={(e) => updateField(field.name, parseInt(e.target.value) || 0)}
                  />
                )}

                {field.type === 'email' && (
                  <Input
                    id={field.name}
                    type="email"
                    value={(formData[field.name] as string) || ''}
                    onChange={(e) => updateField(field.name, e.target.value)}
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeChannelModal}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={updateChannel.isPending}>
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
