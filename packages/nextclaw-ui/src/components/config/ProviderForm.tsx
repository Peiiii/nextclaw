import { useEffect, useState } from 'react';
import { useConfig, useConfigMeta, useUpdateProvider } from '@/hooks/useConfig';
import { useUiStore } from '@/stores/ui.store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MaskedInput } from '@/components/common/MaskedInput';
import { KeyValueEditor } from '@/components/common/KeyValueEditor';
import { t } from '@/lib/i18n';
import type { ProviderConfigUpdate } from '@/api/types';

export function ProviderForm() {
  const { providerModal, closeProviderModal } = useUiStore();
  const { data: config } = useConfig();
  const { data: meta } = useConfigMeta();
  const updateProvider = useUpdateProvider();

  const [apiKey, setApiKey] = useState('');
  const [apiBase, setApiBase] = useState('');
  const [extraHeaders, setExtraHeaders] = useState<Record<string, string> | null>(null);

  const providerName = providerModal.provider;
  const providerSpec = meta?.providers.find((p) => p.name === providerName);
  const providerConfig = providerName ? config?.providers[providerName] : null;

  useEffect(() => {
    if (providerConfig) {
      setApiBase(providerConfig.apiBase || providerSpec?.defaultApiBase || '');
      setExtraHeaders(providerConfig.extraHeaders || null);
      setApiKey(''); // Always start with empty for security
    }
  }, [providerConfig, providerSpec]);

  if (!providerModal.open || !providerName) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: ProviderConfigUpdate = {};

    // Only include apiKey if user has entered something
    if (apiKey !== '') {
      payload.apiKey = apiKey;
    }

    if (apiBase && apiBase !== providerSpec?.defaultApiBase) {
      payload.apiBase = apiBase;
    }

    if (extraHeaders && Object.keys(extraHeaders).length > 0) {
      payload.extraHeaders = extraHeaders;
    }

    updateProvider.mutate(
      { provider: providerName, data: payload },
      { onSuccess: () => closeProviderModal() }
    );
  };

  return (
    <Dialog open={providerModal.open} onOpenChange={closeProviderModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{providerSpec?.displayName || providerName}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">{t('apiKey')}</Label>
            <MaskedInput
              id="apiKey"
              value={apiKey}
              isSet={providerConfig?.apiKeySet}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={providerConfig?.apiKeySet ? t('apiKeySet') : ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiBase">{t('apiBase')}</Label>
            <Input
              id="apiBase"
              type="text"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder={providerSpec?.defaultApiBase}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('extraHeaders')}</Label>
            <KeyValueEditor
              value={extraHeaders}
              onChange={setExtraHeaders}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeProviderModal}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={updateProvider.isPending}>
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
