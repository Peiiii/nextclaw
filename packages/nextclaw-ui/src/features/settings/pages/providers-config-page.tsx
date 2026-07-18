import { useMemo, useState } from 'react';
import { KeyRound, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import {
  useCreateProvider,
  useDeleteProvider,
  useProviders,
  useProviderTemplates,
  useUpdateProvider
} from '@/shared/hooks/use-config';
import { LogoBadge } from '@/shared/components/common/logo-badge';
import { SettingsPage } from '@/shared/components/settings/settings-page';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Switch } from '@/shared/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { StatusDot } from '@/shared/components/status/status-dot';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';
import { ProviderForm } from '@/features/settings/components/config/provider-form';
import { useViewportLayout } from '@/app/hooks/use-viewport-layout';
import {
  ConfigSplitEmptyState,
  ConfigSplitPage,
  ConfigSplitPaneBody,
  ConfigSplitPaneHeader,
  ConfigSplitSidebar
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

function sortProvidersForDisplay<T extends { providerId: string; providerType: string | null }>(
  providers: T[],
  pinnedProviderIds: string[] = []
) {
  const pinnedOrder = new Map(pinnedProviderIds.map((providerId, index) => [providerId, index]));
  return providers
    .map((provider, index) => ({ provider, index }))
    .sort((left, right) => {
      const leftPinned = pinnedOrder.get(left.provider.providerId);
      const rightPinned = pinnedOrder.get(right.provider.providerId);
      if (leftPinned !== undefined || rightPinned !== undefined) {
        return (leftPinned ?? Number.MAX_SAFE_INTEGER) - (rightPinned ?? Number.MAX_SAFE_INTEGER);
      }
      const leftPriority = left.provider.providerType === 'nextclaw' ? 1 : 0;
      const rightPriority = right.provider.providerType === 'nextclaw' ? 1 : 0;
      return leftPriority !== rightPriority ? leftPriority - rightPriority : left.index - right.index;
    })
    .map(({ provider }) => provider);
}

function sortTemplatesForPicker<T extends { providerType: string }>(templates: T[]) {
  const zhipuIndex = templates.findIndex((template) => template.providerType === 'zhipu');
  const dashScopeIndex = templates.findIndex((template) => template.providerType === 'dashscope-coding-plan');
  return templates
    .map((template, index) => ({ template, index }))
    .sort((left, right) => {
      const resolveWeight = ({ template, index }: { template: T; index: number }) => {
        if (template.providerType === 'nextclaw') return Number.MAX_SAFE_INTEGER;
        if (template.providerType === 'deepseek' && dashScopeIndex >= 0) return dashScopeIndex - 0.5;
        if (template.providerType === 'mimo' && zhipuIndex >= 0) return zhipuIndex + 0.5;
        return index;
      };
      return resolveWeight(left) - resolveWeight(right);
    })
    .map(({ template }) => template);
}

export function ProvidersConfigPage() {
  const { isMobile } = useViewportLayout();
  const { data: providersView } = useProviders();
  const { data: templatesView } = useProviderTemplates();
  const createProvider = useCreateProvider();
  const deleteProvider = useDeleteProvider();
  const updateProvider = useUpdateProvider();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [providerToDelete, setProviderToDelete] = useState<string | null>(null);
  const [providerPickerOpen, setProviderPickerOpen] = useState(false);
  const [recentProviderIds, setRecentProviderIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const providers = useMemo(
    () => sortProvidersForDisplay(Object.values(providersView?.providers ?? {}), recentProviderIds),
    [providersView?.providers, recentProviderIds]
  );
  const templates = useMemo(() => templatesView?.providerTemplates ?? [], [templatesView?.providerTemplates]);
  const pickerTemplates = useMemo(() => sortTemplatesForPicker(templates), [templates]);
  const templateByType = useMemo(
    () => new Map(templates.map((template) => [template.providerType, template])),
    [templates]
  );

  const filteredProviders = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return providers.filter((provider) => {
      if (!keyword) {
        return true;
      }
      const template = provider.providerType ? templateByType.get(provider.providerType) : null;
      const display = provider.displayName?.trim() || template?.displayName || provider.providerId;
      return display.toLowerCase().includes(keyword) || provider.providerId.toLowerCase().includes(keyword);
    });
  }, [providers, query, templateByType]);

  const resolvedSelectedProvider = useMemo(() => {
    if (selectedProvider && filteredProviders.some((provider) => provider.providerId === selectedProvider)) {
      return selectedProvider;
    }
    return isMobile ? null : (filteredProviders[0]?.providerId ?? null);
  }, [filteredProviders, isMobile, selectedProvider]);

  if (!providersView || !templatesView) {
    return (
      <SettingsPage title={t('providersPageTitle')} description={t('providersPageDescription')} layout='split'>
        <div className='text-sm text-muted-foreground'>{t('providersLoading')}</div>
      </SettingsPage>
    );
  }

  return (
    <SettingsPage title={t('providersPageTitle')} description={t('providersPageDescription')} layout='split'>
      <ConfigSplitPage
        className='md:min-h-0'
        compactView={selectedProvider ? 'detail' : 'list'}
        onMobileBack={() => setSelectedProvider(null)}
        mobileListLabel={t('providersPageTitle')}
      >
        <ConfigSplitSidebar>
          <ConfigSplitPaneHeader className='space-y-3 px-4 pb-3 pt-4'>
            <Popover open={providerPickerOpen} onOpenChange={setProviderPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type='button'
                  variant='outline'
                  className='w-full justify-center'
                  disabled={createProvider.isPending}
                >
                  <Plus className='mr-2 h-4 w-4' />
                  {createProvider.isPending ? t('saving') : t('providerAdd')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-[42rem] max-w-[calc(100vw-2rem)] p-3' align='start'>
                <div className='mb-2 px-1 text-xs font-semibold text-muted-foreground'>
                  {t('providerTemplatePickerTitle')}
                </div>
                <div className='grid max-h-[24rem] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3'>
                  <button
                    type='button'
                    className='flex min-h-20 w-full flex-col items-start gap-2 rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-left transition-colors hover:border-border hover:bg-muted/45'
                    onClick={async () => {
                      try {
                        const result = await createProvider.mutateAsync({
                          data: { providerType: null }
                        });
                        setQuery('');
                        setSelectedProvider(result.providerId);
                        setRecentProviderIds((current) => [
                          result.providerId,
                          ...current.filter((providerId) => providerId !== result.providerId)
                        ]);
                        setProviderPickerOpen(false);
                      } catch {
                        // toast handled in hook
                      }
                    }}
                  >
                    <LogoBadge name='custom' className='h-8 w-8 rounded-lg border border-border/60 bg-muted/50' />
                    <span className='line-clamp-2 min-w-0 text-xs font-semibold leading-4 text-foreground'>
                      {t('providerAddCustom')}
                    </span>
                  </button>
                  {pickerTemplates.map((template) => (
                    <button
                      key={template.providerType}
                      type='button'
                      className='flex min-h-20 w-full flex-col items-start gap-2 rounded-lg border border-border/55 bg-muted/15 px-3 py-2 text-left transition-colors hover:border-border/80 hover:bg-muted/40'
                      onClick={async () => {
                        try {
                          const result = await createProvider.mutateAsync({
                            data: { providerType: template.providerType }
                          });
                          setQuery('');
                          setSelectedProvider(result.providerId);
                          setRecentProviderIds((current) => [
                            result.providerId,
                            ...current.filter((providerId) => providerId !== result.providerId)
                          ]);
                          setProviderPickerOpen(false);
                        } catch {
                          // toast handled in hook
                        }
                      }}
                    >
                      <LogoBadge
                        name={template.providerType}
                        src={template.logo ? `/logos/${template.logo}` : null}
                        className='h-8 w-8 rounded-lg border border-border/55 bg-background'
                        imgClassName='h-4 w-4 object-contain'
                      />
                      <span className='line-clamp-2 min-w-0 text-xs font-semibold leading-4 text-foreground'>
                        {template.displayName || template.providerType}
                      </span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </ConfigSplitPaneHeader>

          <div className='border-b border-border/70 px-4 py-3'>
            <div className='relative'>
              <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70' />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('providersFilterPlaceholder')}
                className='h-10 rounded-xl pl-9'
              />
            </div>
          </div>

          <ConfigSplitPaneBody className='space-y-2 p-3'>
            {filteredProviders.map((provider) => {
              const template = provider.providerType ? templateByType.get(provider.providerType) : null;
              const isEnabled = provider.enabled !== false;
              const isReady = Boolean(isEnabled && provider.apiKeySet);
              const providerLabel = provider.displayName?.trim() || template?.displayName || provider.providerId;
              const description =
                formatBasePreview(provider.apiBase || template?.defaultApiBase || '') ||
                t('providersDefaultDescription');

              return (
                <div
                  key={provider.providerId}
                  onClick={() => setSelectedProvider(provider.providerId)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedProvider(provider.providerId);
                    }
                  }}
                  role='button'
                  tabIndex={0}
                  className={cn(
                    'group w-full rounded-xl p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                    resolvedSelectedProvider === provider.providerId
                      ? 'bg-background/95 text-foreground shadow-sm'
                      : 'bg-transparent text-muted-foreground hover:bg-background/65 hover:text-foreground'
                  )}
                >
                  <div className='relative min-h-10'>
                    <div className='flex min-w-0 items-center gap-3 pr-20'>
                      <LogoBadge
                        name={provider.providerType ?? provider.providerId}
                        src={template?.logo ? `/logos/${template.logo}` : null}
                        className='h-10 w-10 rounded-lg bg-background/80'
                        imgClassName='h-5 w-5 object-contain'
                        fallback={
                          <span className='text-sm font-semibold uppercase text-muted-foreground'>
                            {provider.providerId[0]}
                          </span>
                        }
                      />
                      <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold text-foreground'>{providerLabel}</p>
                        <p className='truncate font-mono text-[10px] text-muted-foreground/65'>{provider.providerId}</p>
                        <p className='line-clamp-1 text-[11px] text-muted-foreground'>
                          {description} · {provider.models?.length ?? 0}
                        </p>
                      </div>
                    </div>
                    <div className='absolute right-0 top-0 flex items-center gap-1.5 opacity-70 transition-opacity group-hover:opacity-100'>
                      <div onClick={(event) => event.stopPropagation()}>
                        <Switch
                          checked={isEnabled}
                          disabled={updateProvider.isPending}
                          title={isEnabled ? t('disabled') : t('enabled')}
                          className='h-[18px] w-8'
                          thumbClassName='h-4 w-4 data-[state=checked]:translate-x-4'
                          onCheckedChange={(enabled) => {
                            void updateProvider.mutateAsync({
                              provider: provider.providerId,
                              data: { enabled },
                              silentSuccess: true
                            });
                          }}
                        />
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type='button'
                            className='inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/70 hover:bg-muted hover:text-foreground'
                            onClick={(event) => event.stopPropagation()}
                            title={t('more')}
                          >
                            <MoreHorizontal className='h-4 w-4' />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className='w-40 p-1' align='end' onClick={(event) => event.stopPropagation()}>
                          <button
                            type='button'
                            className='flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-red-600 hover:bg-red-50'
                            onClick={() => setProviderToDelete(provider.providerId)}
                          >
                            <Trash2 className='h-4 w-4' />
                            {t('providerDelete')}
                          </button>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <StatusDot
                      status={isEnabled ? (isReady ? 'ready' : 'setup') : 'inactive'}
                      label={isEnabled ? (isReady ? t('statusReady') : t('statusSetup')) : t('disabled')}
                      className='absolute bottom-0 right-0 justify-end'
                    />
                  </div>
                </div>
              );
            })}

            {filteredProviders.length === 0 ? (
              <ConfigSplitEmptyState icon={KeyRound} title={t('providersNoMatch')} />
            ) : null}
          </ConfigSplitPaneBody>
        </ConfigSplitSidebar>

        <ProviderForm
          providerName={resolvedSelectedProvider ?? undefined}
          onProviderDeleted={(deletedProvider) => {
            setRecentProviderIds((current) => current.filter((providerId) => providerId !== deletedProvider));
            if (deletedProvider === resolvedSelectedProvider) {
              setSelectedProvider(null);
            }
          }}
        />
      </ConfigSplitPage>
      <ConfirmDialog
        open={Boolean(providerToDelete)}
        onOpenChange={(open) => {
          if (!open) setProviderToDelete(null);
        }}
        title={t('providerDelete')}
        description={providerToDelete ?? undefined}
        confirmLabel={t('delete')}
        variant='destructive'
        onCancel={() => setProviderToDelete(null)}
        onConfirm={() => {
          if (!providerToDelete) return;
          void deleteProvider.mutateAsync({ provider: providerToDelete }).then(() => {
            setRecentProviderIds((current) => current.filter((providerId) => providerId !== providerToDelete));
            if (providerToDelete === resolvedSelectedProvider) {
              setSelectedProvider(null);
            }
            setProviderToDelete(null);
          });
        }}
      />
    </SettingsPage>
  );
}
