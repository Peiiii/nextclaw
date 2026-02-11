import { useConfig, useConfigMeta } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { KeyRound, Lock, Check, Plus, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { ProviderForm } from './ProviderForm';
import { useUiStore } from '@/stores/ui.store';
import { cn } from '@/lib/utils';

export function ProvidersList() {
  const { data: config } = useConfig();
  const { data: meta } = useConfigMeta();
  const { openProviderModal } = useUiStore();
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);

  if (!config || !meta) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-6">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-4 w-full mt-4" />
              <Skeleton className="h-4 w-2/3 mt-2" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">AI 提供商</h2>
          <p className="text-sm text-slate-500 mt-1">配置和管理您的 AI 服务提供商</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => openProviderModal('')}
        >
          <Plus className="h-4 w-4" />
          添加提供商
        </Button>
      </div>

      {/* Provider Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {meta.providers.map((provider) => {
          const providerConfig = config.providers[provider.name];
          const hasConfig = providerConfig?.apiKeySet;
          const isHovered = hoveredProvider === provider.name;

          return (
            <Card
              key={provider.name}
              className={cn(
                'group cursor-pointer transition-all duration-200',
                'hover:shadow-lg hover:-translate-y-0.5',
                isHovered && 'ring-2 ring-slate-900'
              )}
              onMouseEnter={() => setHoveredProvider(provider.name)}
              onMouseLeave={() => setHoveredProvider(null)}
              onClick={() => openProviderModal(provider.name)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'h-10 w-10 rounded-lg flex items-center justify-center transition-colors',
                      hasConfig ? 'bg-slate-900' : 'bg-slate-100'
                    )}>
                      {hasConfig ? (
                        <Check className="h-5 w-5 text-white" />
                      ) : (
                        <KeyRound className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">
                        {provider.displayName || provider.name}
                      </CardTitle>
                      <p className="text-xs text-slate-400">{provider.name}</p>
                    </div>
                  </div>
                  {hasConfig && (
                    <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                      <Lock className="h-3 w-3" />
                      已配置
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-slate-500 line-clamp-2">
                  点击配置此 AI 提供商的 API 密钥和设置
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                  <ExternalLink className="h-3 w-3" />
                  <span>点击编辑配置</span>
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
