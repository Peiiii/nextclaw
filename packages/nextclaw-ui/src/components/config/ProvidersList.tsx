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
        <h2 className="text-2xl font-bold text-[hsl(30,15%,10%)]">AI Providers</h2>
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
                'group relative flex flex-col p-5 rounded-2xl border transition-all duration-300 cursor-pointer',
                'hover:shadow-lg hover:-translate-y-0.5',
                hasConfig
                  ? 'bg-white border-[hsl(40,10%,90%)] hover:border-[hsl(40,10%,80%)]'
                  : 'bg-[hsl(40,10%,98%)] border-[hsl(40,10%,92%)] hover:border-[hsl(40,10%,85%)] hover:bg-white'
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
                      ? 'bg-white border-[hsl(30,15%,10%)]'
                      : 'bg-white border-[hsl(40,10%,88%)] group-hover:border-[hsl(40,10%,80%)]'
                  )}
                  imgClassName="h-7 w-7"
                  fallback={(
                    <span className={cn(
                      'text-lg font-bold uppercase',
                      hasConfig ? 'text-[hsl(30,15%,10%)]' : 'text-[hsl(30,8%,55%)]'
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
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[hsl(40,10%,94%)] text-[hsl(30,8%,55%)]">
                    <Settings className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-bold">Setup</span>
                  </div>
                )}
              </div>

              {/* Provider Info */}
              <div className="flex-1">
                <h3 className="text-[15px] font-bold text-[hsl(30,15%,10%)] mb-1">
                  {provider.displayName || provider.name}
                </h3>
                <p className="text-[12px] text-[hsl(30,8%,55%)] leading-relaxed line-clamp-2">
                  {provider.name === 'openai' 
                    ? 'Leading AI models including GPT-4 and GPT-3.5' 
                    : 'Configure AI services for your agents'}
                </p>
              </div>

              {/* Footer with Action */}
              <div className="mt-4 pt-4 border-t border-[hsl(40,10%,94%)]">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'w-full rounded-xl text-[12px] font-bold h-9 transition-all',
                    hasConfig
                      ? 'bg-[hsl(40,10%,96%)] hover:bg-[hsl(40,10%,92%)] text-[hsl(30,15%,10%)]'
                      : 'bg-[hsl(30,15%,10%)] hover:bg-[hsl(30,15%,20%)] text-white'
                  )}
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
          <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-[hsl(40,10%,96%)] mb-4">
            <KeyRound className="h-8 w-8 text-[hsl(30,8%,55%)]" />
          </div>
          <h3 className="text-[15px] font-bold text-[hsl(30,15%,10%)] mb-2">
            No providers configured
          </h3>
          <p className="text-[13px] text-[hsl(30,8%,55%)] max-w-sm">
            Add an AI provider to start using the platform. Click on any provider to configure it.
          </p>
        </div>
      )}

      <ProviderForm />
    </div>
  );
}
