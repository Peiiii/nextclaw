import { useEffect, useState } from 'react';
import { useConfig, useConfigMeta, useUpdateProvider } from '@/hooks/useConfig';
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
import { MaskedInput } from '@/components/common/MaskedInput';
import { KeyValueEditor } from '@/components/common/KeyValueEditor';
import { t } from '@/lib/i18n';
import type { ProviderConfigUpdate } from '@/api/types';
import { KeyRound, Globe, Hash } from 'lucide-react';

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

    if (!providerName) return;

    updateProvider.mutate(
      { provider: providerName, data: payload },
      { onSuccess: () => closeProviderModal() }
    );
  };

  return (
    <Dialog open={providerModal.open} onOpenChange={closeProviderModal}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <KeyRound className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle>{providerSpec?.displayName || providerName}</DialogTitle>
              <DialogDescription>Configure API keys and parameters for AI provider</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-2.5">
            <Label htmlFor="apiKey" className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5 text-gray-500" />
              {t('apiKey')}
            </Label>
            <MaskedInput
              id="apiKey"
              value={apiKey}
              isSet={providerConfig?.apiKeySet}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={providerConfig?.apiKeySet ? t('apiKeySet') : 'Enter API Key'}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="apiBase" className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-gray-500" />
              {t('apiBase')}
            </Label>
            <Input
              id="apiBase"
              type="text"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder={providerSpec?.defaultApiBase || 'https://api.example.com'}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2.5">
            <Label className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <Hash className="h-3.5 w-3.5 text-gray-500" />
              {t('extraHeaders')}
            </Label>
            <KeyValueEditor
              value={extraHeaders}
              onChange={setExtraHeaders}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeProviderModal}
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={updateProvider.isPending}
            >
              {updateProvider.isPending ? 'Saving...' : t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
