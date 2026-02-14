import { useConfig, useConfigMeta } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { MessageCircle, Mail, MessageSquare, Slack, ExternalLink, Bell, Zap, Radio } from 'lucide-react';
import { useState } from 'react';
import { ChannelForm } from './ChannelForm';
import { useUiStore } from '@/stores/ui.store';
import { cn } from '@/lib/utils';
import { Tabs } from '@/components/ui/tabs-custom';
import { LogoBadge } from '@/components/common/LogoBadge';
import { getChannelLogo } from '@/lib/logos';

const channelIcons: Record<string, typeof MessageCircle> = {
  telegram: MessageCircle,
  slack: Slack,
  email: Mail,
  webhook: Bell,
  default: MessageSquare
};

const channelDescriptions: Record<string, string> = {
  telegram: 'Connect with Telegram bots for instant messaging',
  slack: 'Integrate with Slack workspaces for team collaboration',
  email: 'Send and receive messages via email protocols',
  webhook: 'Receive HTTP webhooks for custom integrations',
  discord: 'Connect Discord bots to your community servers',
  feishu: 'Enterprise messaging and collaboration platform'
};

export function ChannelsList() {
  const { data: config } = useConfig();
  const { data: meta } = useConfigMeta();
  const { openChannelModal } = useUiStore();
  const [activeTab, setActiveTab] = useState('active');

  if (!config || !meta) {
    return <div className="p-8 text-gray-400">Loading channels...</div>;
  }

  const tabs = [
    { id: 'active', label: 'Enabled', count: meta.channels.filter(c => config.channels[c.name]?.enabled).length },
    { id: 'all', label: 'All Channels', count: meta.channels.length }
  ];

  const filteredChannels = meta.channels.filter(channel => {
    const enabled = config.channels[channel.name]?.enabled || false;
    return activeTab === 'all' || enabled;
  });

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Message Channels</h2>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Channel Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredChannels.map((channel) => {
          const channelConfig = config.channels[channel.name];
          const enabled = channelConfig?.enabled || false;
          const Icon = channelIcons[channel.name] || channelIcons.default;

          return (
            <div
              key={channel.name}
              className={cn(
                'group relative flex flex-col p-5 rounded-2xl border transition-all duration-base cursor-pointer',
                'hover:shadow-card-hover hover:-translate-y-0.5',
                enabled
                  ? 'bg-white border-gray-200 hover:border-gray-300'
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-white'
              )}
              onClick={() => openChannelModal(channel.name)}
            >
              {/* Header with Icon and Status */}
              <div className="flex items-start justify-between mb-4">
                <LogoBadge
                  name={channel.name}
                  src={getChannelLogo(channel.name)}
                  className={cn(
                    'h-12 w-12 rounded-xl border transition-all',
                    enabled
                      ? 'bg-white border-primary'
                      : 'bg-white border-gray-200 group-hover:border-gray-300'
                  )}
                  imgClassName="h-6 w-6"
                  fallback={<Icon className="h-6 w-6" />}
                />
                
                {/* Status Badge */}
                {enabled ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">
                    <Zap className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-bold">Active</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                    <Radio className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-bold">Inactive</span>
                  </div>
                )}
              </div>

              {/* Channel Info */}
              <div className="flex-1">
                <h3 className="text-[15px] font-bold text-gray-900 mb-1">
                  {channel.displayName || channel.name}
                </h3>
                <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-2">
                  {channelDescriptions[channel.name] || 'Configure this communication channel'}
                </p>
              </div>

              {/* Footer with Actions */}
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                {channel.tutorialUrl && (
                  <a
                    href={channel.tutorialUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center h-9 w-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                    title="View Guide"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <Button
                  variant={enabled ? 'ghost' : 'default'}
                  size="sm"
                  className="flex-1 rounded-xl text-xs font-semibold h-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    openChannelModal(channel.name);
                  }}
                >
                  {enabled ? 'Configure' : 'Enable'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredChannels.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-gray-100 mb-4">
            <MessageSquare className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-[15px] font-bold text-gray-900 mb-2">
            No channels enabled
          </h3>
          <p className="text-[13px] text-gray-500 max-w-sm">
            Enable a messaging channel to start receiving messages. Click on any channel to configure it.
          </p>
        </div>
      )}

      <ChannelForm />
    </div>
  );
}
