import { useMemo, useState } from 'react';
import { KeyRound, Plus, Search } from 'lucide-react';
import { useConfig, useConfigMeta, useConfigSchema, useCreateProvider } from '@/hooks/useConfig';
import { LogoBadge } from '@/components/common/LogoBadge';
import { PageHeader, PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs } from '@/components/ui/tabs-custom';
import { StatusDot } from '@/components/ui/status-dot';
import { hintForPath } from '@/lib/config-hints';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { ProviderForm } from '@/components/config/ProviderForm';
import {
  ConfigSelectionCard,
  ConfigSplitEmptyState,
  ConfigSplitPage,
  ConfigSplitPaneBody,
  ConfigSplitPaneHeader,
  ConfigSplitSidebar,
} from '@/shared/components/config-split-page';

function formatBasePreview(base?: string | null) {
  if (!base) {
    return null;
  }
  try {
    const parsed = new URL(base);
    return `${parsed.host}${parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : ''}`;
  } catch {
    return base.replace(/^https?:\/\//, '');
  }
}

function sortProvidersForDisplay<T extends { name: string }>(providers: T[]) {
  return providers
    .map((provider, index) => ({ provider, index }))
    .sort((left, right) => {
      const leftPriority = left.provider.name === 'nextclaw' ? 1 : 0;
      const rightPriority = right.provider.name === 'nextclaw' ? 1 : 0;
      return leftPriority !== rightPriority ? leftPriority - rightPriority : left.index - right.index;
    })
    .map(({ provider }) => provider);
}

export function ProvidersList() {
  const { data: config } = useConfig();
  const { data: meta } = useConfigMeta();
  const { data: schema } = useConfigSchema();
  const createProvider = useCreateProvider();
  const [activeTab, setActiveTab] = useState('installed');
  const [selectedProvider, setSelectedProvider] = useState<string>();
  const [query, setQuery] = useState('');
  const providers = useMemo(() => sortProvidersForDisplay(meta?.providers ?? []), [meta?.providers]);
  const providersConfig = config?.providers ?? {};

  const filteredProviders = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return providers
      .filter((provider) =>
        activeTab !== 'installed' || Boolean(providersConfig[provider.name]?.enabled !== false && providersConfig[provider.name]?.apiKeySet),
      )
      .filter((provider) => {
        if (!keyword) {
          return true;
        }
        const display =
          providersConfig[provider.name]?.displayName?.trim() || provider.displayName || provider.name;
        return display.toLowerCase().includes(keyword) || provider.name.toLowerCase().includes(keyword);
      });
  }, [activeTab, providers, providersConfig, query]);

  const resolvedSelectedProvider = useMemo(() => {
    if (filteredProviders.some((provider) => provider.name === selectedProvider)) {
      return selectedProvider;
    }
    return filteredProviders[0]?.name;
  }, [filteredProviders, selectedProvider]);

  if (!config || !meta) {
    return <div className="p-8">{t('providersLoading')}</div>;
  }

  return (
    <PageLayout className="pb-0 xl:flex xl:h-full xl:min-h-0 xl:flex-col">
      <PageHeader title={t('providersPageTitle')} description={t('providersPageDescription')} />
      <ConfigSplitPage className="xl:min-h-0">
        <ConfigSplitSidebar>
          <ConfigSplitPaneHeader className="space-y-3 px-4 pb-3 pt-4">
            <Tabs
              tabs={[
                {
                  id: 'installed',
                  label: t('providersTabConfigured'),
                  count: providers.filter((provider) => providersConfig[provider.name]?.enabled !== false && providersConfig[provider.name]?.apiKeySet).length,
                },
                { id: 'all', label: t('providersTabAll'), count: providers.length },
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
              className="mb-0"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center"
              onClick={async () => {
                try {
                  const result = await createProvider.mutateAsync({ data: {} });
                  setActiveTab('all');
                  setQuery('');
                  setSelectedProvider(result.name);
                } catch {
                  // toast handled in hook
                }
              }}
              disabled={createProvider.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              {createProvider.isPending ? t('saving') : t('providerAddCustom')}
            </Button>
          </ConfigSplitPaneHeader>

          <div className="border-b border-gray-100 px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('providersFilterPlaceholder')}
                className="h-10 rounded-xl pl-9"
              />
            </div>
          </div>

          <ConfigSplitPaneBody className="space-y-2 p-3">
            {filteredProviders.map((provider) => {
              const providerConfig = providersConfig[provider.name];
              const isEnabled = providerConfig?.enabled !== false;
              const isReady = Boolean(isEnabled && providerConfig?.apiKeySet);
              const providerLabel = providerConfig?.displayName?.trim() || provider.displayName || provider.name;
              const description = formatBasePreview(providerConfig?.apiBase || provider.defaultApiBase || '') || hintForPath(`providers.${provider.name}`, schema?.uiHints)?.help || t('providersDefaultDescription');

              return (
                <ConfigSelectionCard
                  key={provider.name}
                  onClick={() => setSelectedProvider(provider.name)}
                  active={resolvedSelectedProvider === provider.name}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <LogoBadge
                        name={provider.name}
                        src={provider.logo ? `/logos/${provider.logo}` : null}
                        className={cn(
                          'h-10 w-10 rounded-lg border',
                          isReady ? 'border-primary/30 bg-white' : 'border-gray-200/70 bg-white',
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
                      status={isEnabled ? (isReady ? 'ready' : 'setup') : 'inactive'}
                      label={isEnabled ? (isReady ? t('statusReady') : t('statusSetup')) : t('disabled')}
                      className="min-w-[56px] justify-center"
                    />
                  </div>
                </ConfigSelectionCard>
              );
            })}

            {filteredProviders.length === 0 ? (
              <ConfigSplitEmptyState icon={KeyRound} title={t('providersNoMatch')} />
            ) : null}
          </ConfigSplitPaneBody>
        </ConfigSplitSidebar>

        <ProviderForm
          providerName={resolvedSelectedProvider}
          onProviderDeleted={(deletedProvider) => {
            if (deletedProvider === resolvedSelectedProvider) {
              setSelectedProvider(undefined);
            }
          }}
        />
      </ConfigSplitPage>
    </PageLayout>
  );
}
