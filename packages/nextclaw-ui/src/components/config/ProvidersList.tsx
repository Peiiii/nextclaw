import { useConfig, useConfigMeta, useUpdateProvider } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { t } from '@/lib/i18n';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { ProviderForm } from './ProviderForm';
import { useUiStore } from '@/stores/ui.store';

export function ProvidersList() {
  const { data: config } = useConfig();
  const { data: meta } = useConfigMeta();
  const { openProviderModal } = useUiStore();

  if (!config || !meta) {
    return <div className="text-muted-foreground">{t('loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {meta.providers.map((provider) => {
          const providerConfig = config.providers[provider.name];
          const isSet = providerConfig?.apiKeySet || false;

          return (
            <Card key={provider.name} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{provider.displayName || provider.name}</span>
                  <KeyRound className={cn('h-4 w-4', isSet ? 'text-green-500' : 'text-muted-foreground')} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('apiKey')}</span>
                    <span className={isSet ? 'text-green-600' : 'text-muted-foreground'}>
                      {isSet ? t('apiKeySet') : t('apiKeyNotSet')}
                    </span>
                  </div>
                  {provider.defaultApiBase && (
                    <div className="text-xs text-muted-foreground truncate">
                      {provider.defaultApiBase}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => openProviderModal(provider.name)}
                  >
                    {isSet ? t('edit') : t('add')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <ProviderForm />
    </div>
  );
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
