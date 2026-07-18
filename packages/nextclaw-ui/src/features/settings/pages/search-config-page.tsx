import { useState } from 'react';
import { KeyRound, Search as SearchIcon } from 'lucide-react';
import { SettingsPage } from '@/shared/components/settings/settings-page';
import { NavigationLink } from '@/shared/components/actions/navigation-link';
import { Button } from '@/shared/components/ui/button';
import { FormActions } from '@/shared/components/ui/actions/form-actions';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useConfig, useConfigMeta, useUpdateSearch } from '@/shared/hooks/use-config';
import { t } from '@/shared/lib/i18n';
import type { SearchConfigUpdate, SearchProviderName, TavilySearchDepthValue } from '@/shared/lib/api';
import {
  ConfigSelectionCard,
  ConfigSplitDetailPane,
  ConfigSplitEmptyPane,
  ConfigSplitPage,
  ConfigSplitPaneBody,
  ConfigSplitPaneFooter,
  ConfigSplitPaneHeader,
  ConfigSplitSidebar
} from '@/shared/components/config-split-page';
import { useViewportLayout } from '@/app/hooks/use-viewport-layout';

const FRESHNESS_OPTIONS = [
  { value: 'noLimit', label: 'searchFreshnessNoLimit' },
  { value: 'oneDay', label: 'searchFreshnessOneDay' },
  { value: 'oneWeek', label: 'searchFreshnessOneWeek' },
  { value: 'oneMonth', label: 'searchFreshnessOneMonth' },
  { value: 'oneYear', label: 'searchFreshnessOneYear' }
] as const;

const SEARCH_DEPTH_OPTIONS = [
  { value: 'basic', label: 'searchDepthBasic' },
  { value: 'advanced', label: 'searchDepthAdvanced' }
] as const;

const ENABLED_OPTIONS = [
  { value: 'true', label: 'enabled' },
  { value: 'false', label: 'disabled' }
] as const;

const SEARCH_PROVIDER_DESCRIPTION_KEYS: Record<SearchProviderName, string> = {
  bocha: 'searchProviderBochaDescription',
  tavily: 'searchProviderTavilyDescription',
  brave: 'searchProviderBraveDescription'
};

type SearchDraft = {
  activeProvider: SearchProviderName;
  enabledProviders: SearchProviderName[];
  maxResults: string;
  providers: {
    bocha: {
      apiKey: string;
      baseUrl: string;
      summary: boolean;
      freshness: string;
    };
    tavily: {
      apiKey: string;
      baseUrl: string;
      searchDepth: TavilySearchDepthValue;
      includeAnswer: boolean;
    };
    brave: { apiKey: string; baseUrl: string };
  };
};

type SearchView = NonNullable<ReturnType<typeof useConfig>['data']>['search'];
type SearchProviderMeta = NonNullable<ReturnType<typeof useConfigMeta>['data']>['search'][number];
type UpdateProviderDraft = <T extends SearchProviderName>(
  provider: T,
  patch: Partial<SearchDraft['providers'][T]>
) => void;

function buildSearchDraft(search: SearchView): SearchDraft {
  return {
    activeProvider: search.provider,
    enabledProviders: search.enabledProviders,
    maxResults: String(search.defaults.maxResults),
    providers: {
      bocha: {
        apiKey: '',
        baseUrl: search.providers.bocha.baseUrl,
        summary: Boolean(search.providers.bocha.summary),
        freshness: search.providers.bocha.freshness ?? 'noLimit'
      },
      tavily: {
        apiKey: '',
        baseUrl: search.providers.tavily.baseUrl,
        searchDepth: search.providers.tavily.searchDepth ?? 'basic',
        includeAnswer: Boolean(search.providers.tavily.includeAnswer)
      },
      brave: { apiKey: '', baseUrl: search.providers.brave.baseUrl }
    }
  };
}

function buildSearchPayload(draft: SearchDraft): SearchConfigUpdate {
  return {
    provider: draft.activeProvider,
    enabledProviders: draft.enabledProviders,
    defaults: { maxResults: Number(draft.maxResults) || 10 },
    providers: {
      bocha: {
        apiKey: draft.providers.bocha.apiKey || undefined,
        baseUrl: draft.providers.bocha.baseUrl,
        summary: draft.providers.bocha.summary,
        freshness: draft.providers.bocha.freshness
      },
      tavily: {
        apiKey: draft.providers.tavily.apiKey || undefined,
        baseUrl: draft.providers.tavily.baseUrl,
        searchDepth: draft.providers.tavily.searchDepth,
        includeAnswer: draft.providers.tavily.includeAnswer
      },
      brave: {
        apiKey: draft.providers.brave.apiKey || undefined,
        baseUrl: draft.providers.brave.baseUrl
      }
    }
  };
}

function SearchTextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: 'numeric';
}) {
  const { label, value, onChange, placeholder, type = 'text', inputMode } = props;
  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className='rounded-xl'
      />
    </div>
  );
}

function SearchSelectField(props: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const { label, value, options, onChange } = props;
  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className='rounded-xl'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.label)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SearchDocsLink({ docsUrl }: { docsUrl?: string }) {
  if (!docsUrl) return null;
  return (
    <NavigationLink href={docsUrl} external>
      {t('searchProviderOpenDocs')}
    </NavigationLink>
  );
}

function SearchProviderFields(props: {
  draft: SearchDraft;
  provider: SearchProviderName;
  search: SearchView;
  selectedDocsUrl?: string;
  updateProviderDraft: UpdateProviderDraft;
}) {
  const { draft, provider, search, selectedDocsUrl, updateProviderDraft } = props;

  if (provider === 'bocha') {
    const { bocha } = draft.providers;
    return (
      <>
        <SearchTextField
          label={t('apiKey')}
          value={bocha.apiKey}
          onChange={(apiKey) => updateProviderDraft('bocha', { apiKey })}
          placeholder={search.providers.bocha.apiKeyMasked || t('enterApiKey')}
          type='password'
        />
        <SearchTextField
          label={t('searchProviderBaseUrl')}
          value={bocha.baseUrl}
          onChange={(baseUrl) => updateProviderDraft('bocha', { baseUrl })}
        />
        <div className='grid gap-4 md:grid-cols-2'>
          <SearchSelectField
            label={t('searchProviderSummary')}
            value={bocha.summary ? 'true' : 'false'}
            options={ENABLED_OPTIONS}
            onChange={(value) => updateProviderDraft('bocha', { summary: value === 'true' })}
          />
          <SearchSelectField
            label={t('searchProviderFreshness')}
            value={bocha.freshness}
            options={FRESHNESS_OPTIONS}
            onChange={(freshness) => updateProviderDraft('bocha', { freshness })}
          />
        </div>
        <SearchDocsLink docsUrl={selectedDocsUrl ?? 'https://open.bocha.cn'} />
      </>
    );
  }

  if (provider === 'tavily') {
    const { tavily } = draft.providers;
    return (
      <>
        <SearchTextField
          label={t('apiKey')}
          value={tavily.apiKey}
          onChange={(apiKey) => updateProviderDraft('tavily', { apiKey })}
          placeholder={search.providers.tavily.apiKeyMasked || t('enterApiKey')}
          type='password'
        />
        <SearchTextField
          label={t('searchProviderBaseUrl')}
          value={tavily.baseUrl}
          onChange={(baseUrl) => updateProviderDraft('tavily', { baseUrl })}
        />
        <div className='grid gap-4 md:grid-cols-2'>
          <SearchSelectField
            label={t('searchProviderSearchDepth')}
            value={tavily.searchDepth}
            options={SEARCH_DEPTH_OPTIONS}
            onChange={(searchDepth) =>
              updateProviderDraft('tavily', {
                searchDepth: searchDepth as TavilySearchDepthValue
              })
            }
          />
          <SearchSelectField
            label={t('searchProviderIncludeAnswer')}
            value={tavily.includeAnswer ? 'true' : 'false'}
            options={ENABLED_OPTIONS}
            onChange={(value) => updateProviderDraft('tavily', { includeAnswer: value === 'true' })}
          />
        </div>
        <SearchDocsLink docsUrl={selectedDocsUrl} />
      </>
    );
  }

  const { brave } = draft.providers;
  return (
    <>
      <SearchTextField
        label={t('apiKey')}
        value={brave.apiKey}
        onChange={(apiKey) => updateProviderDraft('brave', { apiKey })}
        placeholder={search.providers.brave.apiKeyMasked || t('enterApiKey')}
        type='password'
      />
      <SearchTextField
        label={t('searchProviderBaseUrl')}
        value={brave.baseUrl}
        onChange={(baseUrl) => updateProviderDraft('brave', { baseUrl })}
      />
    </>
  );
}

function SearchProviderSidebar(props: {
  draft: SearchDraft;
  providers: SearchProviderMeta[];
  search: SearchView;
  selectedProvider: SearchProviderName;
  onSelect: (provider: SearchProviderName) => void;
}) {
  const { draft, providers, search, selectedProvider, onSelect } = props;
  return (
    <ConfigSplitSidebar>
      <ConfigSplitPaneHeader className='px-4 py-4'>
        <p className='text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground'>{t('searchChannels')}</p>
      </ConfigSplitPaneHeader>
      <ConfigSplitPaneBody className='space-y-2 p-3'>
        {providers.map((provider) => {
          const providerView = search.providers[provider.name];
          const isEnabled = draft.enabledProviders.includes(provider.name);
          return (
            <ConfigSelectionCard
              key={provider.name}
              onClick={() => onSelect(provider.name)}
              active={selectedProvider === provider.name}
              className='p-3'
            >
              <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                  <p className='truncate text-sm font-semibold text-foreground'>{provider.displayName}</p>
                  <p className='line-clamp-2 text-[11px] text-muted-foreground'>
                    {t(SEARCH_PROVIDER_DESCRIPTION_KEYS[provider.name])}
                  </p>
                </div>
                <div className='flex flex-col items-end gap-1'>
                  <span className='rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground'>
                    {providerView.apiKeySet ? t('searchStatusConfigured') : t('searchStatusNeedsSetup')}
                  </span>
                  {isEnabled ? (
                    <span className='rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700'>
                      {t('searchProviderActivated')}
                    </span>
                  ) : null}
                </div>
              </div>
            </ConfigSelectionCard>
          );
        })}
      </ConfigSplitPaneBody>
    </ConfigSplitSidebar>
  );
}

function SearchConfigForm(props: {
  initialDraft: SearchDraft;
  providers: SearchProviderMeta[];
  search: SearchView;
  onSubmit: (draft: SearchDraft) => void;
  isPending: boolean;
}) {
  const { initialDraft, providers, search, onSubmit, isPending } = props;
  const { isMobile } = useViewportLayout();
  const [selectedProvider, setSelectedProvider] = useState<SearchProviderName | null>(null);
  const [draft, setDraft] = useState(initialDraft);
  const resolvedSelectedProvider =
    selectedProvider && providers.some((provider) => provider.name === selectedProvider)
      ? selectedProvider
      : isMobile
        ? null
        : search.provider;
  const selectedMeta = providers.find((provider) => provider.name === resolvedSelectedProvider) ?? null;
  const selectedView = resolvedSelectedProvider ? search.providers[resolvedSelectedProvider] : null;
  const selectedEnabled = resolvedSelectedProvider ? draft.enabledProviders.includes(resolvedSelectedProvider) : false;
  const selectedDocsUrl = selectedView?.docsUrl ?? selectedMeta?.docsUrl;

  const updateProviderDraft: UpdateProviderDraft = (provider, patch) => {
    setDraft((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [provider]: { ...prev.providers[provider], ...patch }
      }
    }));
  };

  const handleToggleEnabled = () => {
    const enabledProviders = selectedEnabled
      ? draft.enabledProviders.filter((provider) => provider !== resolvedSelectedProvider)
      : resolvedSelectedProvider
        ? [...draft.enabledProviders, resolvedSelectedProvider]
        : draft.enabledProviders;
    const nextDraft = { ...draft, enabledProviders };
    setDraft(nextDraft);
    onSubmit(nextDraft);
  };

  return (
    <ConfigSplitPage
      className='md:min-h-0'
      compactView={selectedProvider ? 'detail' : 'list'}
      onMobileBack={() => setSelectedProvider(null)}
      mobileListLabel={t('searchPageTitle')}
    >
      <SearchProviderSidebar
        draft={draft}
        providers={providers}
        search={search}
        selectedProvider={resolvedSelectedProvider ?? search.provider}
        onSelect={setSelectedProvider}
      />
      {!selectedMeta ? (
        <ConfigSplitEmptyPane>
          <p className='text-sm text-muted-foreground'>{t('searchNoProviderSelected')}</p>
        </ConfigSplitEmptyPane>
      ) : (
        <ConfigSplitDetailPane>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit(draft);
            }}
            className='flex min-h-0 flex-1 flex-col'
          >
            <ConfigSplitPaneHeader className='px-5 py-4'>
              <div className='flex items-start justify-between gap-4'>
                <div className='flex items-center gap-3'>
                  <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground'>
                    <SearchIcon className='h-5 w-5' />
                  </div>
                  <div>
                    <h3 className='text-lg font-semibold text-foreground'>{selectedMeta.displayName}</h3>
                    <p className='text-sm text-muted-foreground'>
                      {t(SEARCH_PROVIDER_DESCRIPTION_KEYS[selectedMeta.name])}
                    </p>
                  </div>
                </div>
                <Button
                  type='button'
                  variant={selectedEnabled ? 'secondary' : 'outline'}
                  className='rounded-xl'
                  onClick={handleToggleEnabled}
                >
                  {selectedEnabled ? t('searchProviderDeactivate') : t('searchProviderActivate')}
                </Button>
              </div>
            </ConfigSplitPaneHeader>

            <ConfigSplitPaneBody className='space-y-5 px-5 py-4'>
              <div className='grid gap-4 md:grid-cols-2'>
                <SearchSelectField
                  label={t('searchActiveProvider')}
                  value={draft.activeProvider}
                  options={providers.map((provider) => ({
                    value: provider.name,
                    label: provider.displayName
                  }))}
                  onChange={(activeProvider) =>
                    setDraft({
                      ...draft,
                      activeProvider: activeProvider as SearchProviderName
                    })
                  }
                />
                <SearchTextField
                  label={t('searchDefaultMaxResults')}
                  value={draft.maxResults}
                  onChange={(maxResults) => setDraft({ ...draft, maxResults })}
                  inputMode='numeric'
                />
              </div>

              <SearchProviderFields
                draft={draft}
                provider={resolvedSelectedProvider as SearchProviderName}
                search={search}
                selectedDocsUrl={selectedDocsUrl}
                updateProviderDraft={updateProviderDraft}
              />
            </ConfigSplitPaneBody>

            <ConfigSplitPaneFooter>
              <FormActions>
                <Button type='submit' size='sm' disabled={isPending}>
                  <KeyRound className='mr-1.5 h-3.5 w-3.5' />
                  {isPending ? t('saving') : t('saveChanges')}
                </Button>
              </FormActions>
            </ConfigSplitPaneFooter>
          </form>
        </ConfigSplitDetailPane>
      )}
    </ConfigSplitPage>
  );
}

export function SearchConfigPage() {
  const { data: config } = useConfig();
  const { data: meta } = useConfigMeta();
  const updateSearch = useUpdateSearch();
  const providers = meta?.search ?? [];
  const search = config?.search;

  if (!search || providers.length === 0) {
    return (
      <SettingsPage title={t('searchPageTitle')} description={t('searchPageDescription')} layout='split'>
        <div className='text-sm text-muted-foreground'>{t('loading')}</div>
      </SettingsPage>
    );
  }

  return (
    <SettingsPage title={t('searchPageTitle')} description={t('searchPageDescription')} layout='split'>
      <SearchConfigForm
        key={JSON.stringify(search)}
        initialDraft={buildSearchDraft(search)}
        providers={providers}
        search={search}
        onSubmit={(draft) => updateSearch.mutate({ data: buildSearchPayload(draft) })}
        isPending={updateSearch.isPending}
      />
    </SettingsPage>
  );
}
