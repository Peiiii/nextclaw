import { useConfig, useConfigMeta, useConfigSchema } from '@/hooks/useConfig';
import { MessageSquare, ExternalLink, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ChannelForm } from './ChannelForm';
import { Tabs } from '@/components/ui/tabs-custom';
import { LogoBadge } from '@/components/common/LogoBadge';
import { getChannelLogo } from '@/lib/logos';
import { hintForPath } from '@/lib/config-hints';
import { StatusDot } from '@/components/ui/status-dot';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { PageLayout, PageHeader } from '@/components/layout/page-layout';
import { resolveChannelTutorialUrl } from '@/lib/channel-tutorials';
import { Input } from '@/components/ui/input';
import { CONFIG_SIDEBAR_CARD_CLASS, CONFIG_SPLIT_GRID_CLASS } from './config-layout';

const channelDescriptionKeys: Record<string, string> = {
  telegram: 'channelDescTelegram',
  slack: 'channelDescSlack',
  email: 'channelDescEmail',
  webhook: 'channelDescWebhook',
  discord: 'channelDescDiscord',
  feishu: 'channelDescFeishu',
  weixin: 'channelDescWeixin'
};

const prioritizedChannelNames = ['weixin', 'feishu', 'discord', 'qq'] as const;

function sortChannelsForDisplay<T extends { name: string }>(channels: T[]): T[] {
  const priorityByName = new Map<string, number>(prioritizedChannelNames.map((name, index) => [name, index]));

  return channels
    .map((channel, index) => ({ channel, index }))
    .sort((left, right) => {
      const leftPriority = priorityByName.get(left.channel.name) ?? Number.POSITIVE_INFINITY;
      const rightPriority = priorityByName.get(right.channel.name) ?? Number.POSITIVE_INFINITY;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return left.index - right.index;
    })
    .map(({ channel }) => channel);
}

export function ChannelsList() {
  const { data: config } = useConfig();
  const { data: meta } = useConfigMeta();
  const { data: schema } = useConfigSchema();
  const [activeTab, setActiveTab] = useState('enabled');
  const [selectedChannel, setSelectedChannel] = useState<string | undefined>();
  const [query, setQuery] = useState('');
  const uiHints = schema?.uiHints;
  const channels = useMemo(() => sortChannelsForDisplay(meta?.channels ?? []), [meta?.channels]);
  const channelConfigs = config?.channels;

  const tabs = [
    { id: 'enabled', label: t('channelsTabEnabled'), count: channels.filter((c) => channelConfigs?.[c.name]?.enabled).length },
    { id: 'all', label: t('channelsTabAll'), count: channels.length }
  ];

  const filteredChannels = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return channels
      .filter((channel) => {
        const enabled = channelConfigs?.[channel.name]?.enabled || false;
        if (activeTab === 'enabled') {
          return enabled;
        }
        return true;
      })
      .filter((channel) => {
        if (!keyword) {
          return true;
        }
        const display = (channel.displayName || channel.name).toLowerCase();
        return display.includes(keyword) || channel.name.toLowerCase().includes(keyword);
      });
  }, [activeTab, channelConfigs, channels, query]);

  useEffect(() => {
    if (filteredChannels.length === 0) {
      setSelectedChannel(undefined);
      return;
    }
    const exists = filteredChannels.some((channel) => channel.name === selectedChannel);
    if (!exists) {
      setSelectedChannel(filteredChannels[0].name);
    }
  }, [filteredChannels, selectedChannel]);

  if (!config || !meta) {
    return <div className="p-8 text-gray-400">{t('channelsLoading')}</div>;
  }

  return (
    <PageLayout className="xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:pb-0">
      <PageHeader title={t('channelsPageTitle')} description={t('channelsPageDescription')} />

      <div className={cn(CONFIG_SPLIT_GRID_CLASS, 'xl:min-h-0 xl:flex-1')}>
        <section className={CONFIG_SIDEBAR_CARD_CLASS}>
          <div className="border-b border-gray-100 px-4 pt-4">
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-0" />
          </div>

          <div className="border-b border-gray-100 px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('channelsFilterPlaceholder')}
                className="h-10 rounded-xl pl-9"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
            {filteredChannels.map((channel) => {
              const channelConfig = config.channels[channel.name];
              const enabled = channelConfig?.enabled || false;
              const channelHint = hintForPath(`channels.${channel.name}`, uiHints);
              const tutorialUrl = resolveChannelTutorialUrl(channel);
              const description =
                channelHint?.help ||
                t(channelDescriptionKeys[channel.name] || 'channelDescriptionDefault');
              const isActive = selectedChannel === channel.name;

              return (
                <button
                  key={channel.name}
                  type="button"
                  onClick={() => setSelectedChannel(channel.name)}
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
                        name={channel.name}
                        src={getChannelLogo(channel.name)}
                        className={cn(
                          'h-10 w-10 rounded-lg border',
                          enabled ? 'border-primary/30 bg-white' : 'border-gray-200/70 bg-white'
                        )}
                        imgClassName="h-5 w-5 object-contain"
                        fallback={<span className="text-sm font-semibold uppercase text-gray-500">{channel.name[0]}</span>}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{channel.displayName || channel.name}</p>
                        <p className="line-clamp-1 text-[11px] text-gray-500">{description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {tutorialUrl && (
                        <a
                          href={tutorialUrl}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-300 transition-colors hover:bg-gray-100/70 hover:text-gray-500"
                          title={t('channelsGuideTitle')}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <StatusDot
                        status={enabled ? 'active' : 'inactive'}
                        label={enabled ? t('statusActive') : t('statusInactive')}
                        className="min-w-[56px] justify-center"
                      />
                    </div>
                  </div>
                </button>
              );
            })}

            {filteredChannels.length === 0 && (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/70 py-10 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white">
                  <MessageSquare className="h-5 w-5 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-700">{t('channelsNoMatch')}</p>
              </div>
            )}
          </div>
        </section>

        <ChannelForm channelName={selectedChannel} />
      </div>
    </PageLayout>
  );
}
