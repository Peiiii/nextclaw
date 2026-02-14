import { useConfig, useConfigMeta } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { KeyRound, Check, Settings } from 'lucide-react';
import { useState } from 'react';
import { ProviderForm } from './ProviderForm';
import { useUiStore } from '@/stores/ui.store';
import { cn } from '@/lib/utils';
import { Tabs } from '@/components/ui/tabs-custom';
import { LogoBadge } from '@/components/common/LogoBadge';
import { getProviderLogo } from '@/lib/logos';

export function ProvidersList() {
  const { data: config } = useConfig();
  const { data: meta } = useConfigMeta();
  const { openProviderModal } = useUiStore();
  const [activeTab, setActiveTab] = useState('installed');

  if (!config || !meta) {
    return <div className="p-8">Loading...</div>;
  }

  const tabs = [
    { id: 'installed', label: 'Configured', count: config.providers ? Object.keys(config.providers).filter(k => config.providers[k].apiKeySet).length : 0 },
    { id: 'all', label: 'All Providers' }
  ];

  const filteredProviders = activeTab === 'installed'
    ? meta.providers.filter((p) => config.providers[p.name]?.apiKeySet)
    : meta.providers;

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-900">AI Providers</h2>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Provider Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProviders.map((provider) => {
          const providerConfig = config.providers[provider.name];
          const hasConfig = providerConfig?.apiKeySet;

          return (
            <div
              key={provider.name}
              className={cn(
                'group relative flex flex-col p-5 rounded-2xl border transition-all duration-base cursor-pointer',
                'hover:shadow-card-hover hover:-translate-y-0.5',
                hasConfig
                  ? 'bg-white border-gray-200 hover:border-gray-300'
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-white'
              )}
              onClick={() => openProviderModal(provider.name)}
            >
              {/* Header with Logo and Status */}
              <div className="flex items-start justify-between mb-4">
                <LogoBadge
                  name={provider.name}
                  src={getProviderLogo(provider.name)}
                  className={cn(
                    'h-12 w-12 rounded-xl border transition-all',
                    hasConfig
                      ? 'bg-white border-primary'
                      : 'bg-white border-gray-200 group-hover:border-gray-300'
                  )}
                  imgClassName="h-7 w-7"
                  fallback={(
                    <span className={cn(
                      'text-lg font-bold uppercase',
                      hasConfig ? 'text-gray-900' : 'text-gray-500'
                    )}>
                      {provider.name[0]}
                    </span>
                  )}
                />
                
                {/* Status Badge */}
                {hasConfig ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">
                    <Check className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-bold">Ready</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                    <Settings className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-bold">Setup</span>
                  </div>
                )}
              </div>

              {/* Provider Info */}
              <div className="flex-1">
                <h3 className="text-[15px] font-bold text-gray-900 mb-1">
                  {provider.displayName || provider.name}
                </h3>
                <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-2">
                  {provider.name === 'openai' 
                    ? 'Leading AI models including GPT-4 and GPT-3.5' 
                    : 'Configure AI services for your agents'}
                </p>
              </div>

              {/* Footer with Action */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <Button
                  variant={hasConfig ? 'ghost' : 'default'}
                  size="sm"
                  className="w-full rounded-xl text-xs font-semibold h-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    openProviderModal(provider.name);
                  }}
                >
                  {hasConfig ? 'Configure' : 'Add Provider'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredProviders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-gray-100 mb-4">
            <KeyRound className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-[15px] font-bold text-gray-900 mb-2">
            No providers configured
          </h3>
          <p className="text-[13px] text-gray-500 max-w-sm">
            Add an AI provider to start using the platform. Click on any provider to configure it.
          </p>
        </div>
      )}

      <ProviderForm />
    </div>
  );
}
