import { useEffect, useMemo, useState } from 'react';
import { useConfig, useConfigMeta, useConfigSchema, useCreateProvider } from '@/hooks/useConfig';
import { Search, KeyRound, Plus } from 'lucide-react';
import { ProviderForm } from './ProviderForm';
import { cn } from '@/lib/utils';
import { Tabs } from '@/components/ui/tabs-custom';
import { LogoBadge } from '@/components/common/LogoBadge';
import { hintForPath } from '@/lib/config-hints';
import { StatusDot } from '@/components/ui/status-dot';
import { t } from '@/lib/i18n';
import { PageLayout, PageHeader } from '@/components/layout/page-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CONFIG_SIDEBAR_CARD_CLASS, CONFIG_SPLIT_GRID_CLASS } from './config-layout';

function formatBasePreview(base?: string | null): string | null {
  if (!base) {
    return null;
  }
  try {
    const parsed = new URL(base);
    const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
    return `${parsed.host}${path}`;
  } catch {
    return base.replace(/^https?:\/\//, '');
  }
}

export function ProvidersList() {
  const { data: config } = useConfig();
  const { data: meta } = useConfigMeta();
  const { data: schema } = useConfigSchema();
  const createProvider = useCreateProvider();

  const [activeTab, setActiveTab] = useState('installed');
  const [selectedProvider, setSelectedProvider] = useState<string | undefined>();
  const [query, setQuery] = useState('');

  const uiHints = schema?.uiHints;
  const providers = meta?.providers ?? [];
  const providersConfig = config?.providers ?? {};
  const configuredCount = providers.filter((provider) => providersConfig[provider.name]?.apiKeySet).length;

  const tabs = [
    { id: 'installed', label: t('providersTabConfigured'), count: configuredCount },
    { id: 'all', label: t('providersTabAll'), count: providers.length }
  ];

  const filteredProviders = useMemo(() => {
    const baseProviders = meta?.providers ?? [];
    const baseConfig = config?.providers ?? {};
    const keyword = query.trim().toLowerCase();
    return baseProviders
      .filter((provider) => {
        if (activeTab === 'installed') {
          return Boolean(baseConfig[provider.name]?.apiKeySet);
        }
        return true;
      })
      .filter((provider) => {
        if (!keyword) {
          return true;
        }
        const configDisplayName = baseConfig[provider.name]?.displayName?.trim();
        const display = (configDisplayName || provider.displayName || provider.name).toLowerCase();
        return display.includes(keyword) || provider.name.toLowerCase().includes(keyword);
      });
  }, [meta, config, activeTab, query]);

  useEffect(() => {
    if (filteredProviders.length === 0) {
      setSelectedProvider(undefined);
      return;
    }

    const exists = filteredProviders.some((provider) => provider.name === selectedProvider);
    if (!exists) {
      setSelectedProvider(filteredProviders[0].name);
    }
  }, [filteredProviders, selectedProvider]);

  const selectedName = selectedProvider;

  const handleCreateCustomProvider = async () => {
    try {
      const result = await createProvider.mutateAsync({ data: {} });
      setActiveTab('all');
      setQuery('');
      setSelectedProvider(result.name);
    } catch {
      // toast handled in hook
    }
  };

  if (!config || !meta) {
    return <div className="p-8">{t('providersLoading')}</div>;
  }

  return (
    <PageLayout>
      <PageHeader title={t('providersPageTitle')} description={t('providersPageDescription')} />

      <div className={CONFIG_SPLIT_GRID_CLASS}>
        <section className={CONFIG_SIDEBAR_CARD_CLASS}>
          <div className="border-b border-gray-100 px-4 pt-4 pb-3 space-y-3">
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-0" />
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center"
              onClick={handleCreateCustomProvider}
              disabled={createProvider.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              {createProvider.isPending ? t('saving') : t('providerAddCustom')}
            </Button>
          </div>

          <div className="border-b border-gray-100 px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('providersFilterPlaceholder')}
                className="h-10 rounded-xl pl-9"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {filteredProviders.map((provider) => {
              const providerConfig = config.providers[provider.name];
              const isReady = Boolean(providerConfig?.apiKeySet);
              const isActive = selectedName === provider.name;
              const providerLabel = providerConfig?.displayName?.trim() || provider.displayName || provider.name;
              const providerHint = hintForPath(`providers.${provider.name}`, uiHints);
              const resolvedBase = providerConfig?.apiBase || provider.defaultApiBase || '';
              const basePreview = formatBasePreview(resolvedBase);
              const description = basePreview || providerHint?.help || t('providersDefaultDescription');

              return (
                <button
                  key={provider.name}
                  type="button"
                  onClick={() => setSelectedProvider(provider.name)}
                  className={cn(
                    'w-full rounded-xl border p-2.5 text-left transition-all',
                    isActive
                      ? 'border-primary/30 bg-primary-50/40 shadow-sm'
                      : 'border-gray-200/70 bg-white hover:border-gray-300 hover:bg-gray-50/70'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <LogoBadge
                        name={provider.name}
                        src={provider.logo ? `/logos/${provider.logo}` : null}
                        className={cn(
                          'h-10 w-10 rounded-lg border',
                          isReady ? 'border-primary/30 bg-white' : 'border-gray-200/70 bg-white'
                        )}
                        imgClassName="h-5 w-5 object-contain"
                        fallback={<span className="text-sm font-semibold uppercase text-gray-500">{provider.name[0]}</span>}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{providerLabel}</p>
                        <p className="line-clamp-1 text-[11px] text-gray-500">{description}</p>
                      </div>
                    </div>
                    <StatusDot
                      status={isReady ? 'ready' : 'setup'}
                      label={isReady ? t('statusReady') : t('statusSetup')}
                      className="min-w-[56px] justify-center"
                    />
                  </div>
                </button>
              );
            })}

            {filteredProviders.length === 0 && (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/70 py-10 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white">
                  <KeyRound className="h-5 w-5 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-700">{t('providersNoMatch')}</p>
              </div>
            )}
          </div>
        </section>

        <ProviderForm
          providerName={selectedName}
          onProviderDeleted={(deletedProvider) => {
            if (deletedProvider === selectedProvider) {
              setSelectedProvider(undefined);
            }
          }}
        />
      </div>
    </PageLayout>
  );
}
