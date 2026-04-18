import { useEffect, useMemo, useState } from "react";
import { ExternalLink, MessageSquare, Search } from "lucide-react";
import { useConfig, useConfigMeta, useConfigSchema } from "@/hooks/useConfig";
import { LogoBadge } from "@/components/common/LogoBadge";
import { PageHeader, PageLayout } from "@/components/layout/page-layout";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/ui/status-dot";
import { Tabs } from "@/components/ui/tabs-custom";
import { hintForPath } from "@/lib/config-hints";
import { resolveChannelTutorialUrl } from "@/lib/channel-tutorials";
import { t } from "@/lib/i18n";
import { getChannelLogo } from "@/lib/logos";
import { cn } from "@/lib/utils";
import { ChannelForm } from "./ChannelForm";
import {
  ConfigSelectionCard,
  ConfigSplitEmptyState,
  ConfigSplitPage,
  ConfigSplitPaneBody,
  ConfigSplitPaneHeader,
  ConfigSplitSidebar,
} from "./config-split-page";

const channelDescriptionKeys: Record<string, string> = {
  telegram: "channelDescTelegram",
  slack: "channelDescSlack",
  email: "channelDescEmail",
  webhook: "channelDescWebhook",
  discord: "channelDescDiscord",
  feishu: "channelDescFeishu",
  weixin: "channelDescWeixin",
};

const prioritizedChannelNames = ["weixin", "feishu", "discord", "qq"] as const;

function sortChannelsForDisplay<T extends { name: string }>(channels: T[]) {
  const priorityByName = new Map<string, number>(
    prioritizedChannelNames.map((name, index) => [name, index]),
  );
  return channels
    .map((channel, index) => ({ channel, index }))
    .sort((left, right) => {
      const leftPriority = priorityByName.get(left.channel.name) ?? Number.POSITIVE_INFINITY;
      const rightPriority = priorityByName.get(right.channel.name) ?? Number.POSITIVE_INFINITY;
      return leftPriority !== rightPriority ? leftPriority - rightPriority : left.index - right.index;
    })
    .map(({ channel }) => channel);
}

export function ChannelsList() {
  const { data: config } = useConfig();
  const { data: meta } = useConfigMeta();
  const { data: schema } = useConfigSchema();
  const [activeTab, setActiveTab] = useState("enabled");
  const [selectedChannel, setSelectedChannel] = useState<string>();
  const [query, setQuery] = useState("");
  const channels = useMemo(() => sortChannelsForDisplay(meta?.channels ?? []), [meta?.channels]);
  const channelConfigs = config?.channels;

  const filteredChannels = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return channels
      .filter((channel) => activeTab !== "enabled" || Boolean(channelConfigs?.[channel.name]?.enabled))
      .filter((channel) => {
        if (!keyword) {
          return true;
        }
        const display = (channel.displayName || channel.name).toLowerCase();
        return display.includes(keyword) || channel.name.toLowerCase().includes(keyword);
      });
  }, [activeTab, channelConfigs, channels, query]);

  useEffect(() => {
    setSelectedChannel(
      filteredChannels.some((channel) => channel.name === selectedChannel)
        ? selectedChannel
        : filteredChannels[0]?.name,
    );
  }, [filteredChannels, selectedChannel]);

  if (!config || !meta) {
    return <div className="p-8 text-gray-400">{t("channelsLoading")}</div>;
  }

  return (
    <PageLayout className="pb-0 xl:flex xl:h-full xl:min-h-0 xl:flex-col">
      <PageHeader title={t("channelsPageTitle")} description={t("channelsPageDescription")} />
      <ConfigSplitPage className="xl:min-h-0">
        <ConfigSplitSidebar>
          <ConfigSplitPaneHeader className="px-4 pt-4">
            <Tabs
              tabs={[
                {
                  id: "enabled",
                  label: t("channelsTabEnabled"),
                  count: channels.filter((channel) => channelConfigs?.[channel.name]?.enabled).length,
                },
                { id: "all", label: t("channelsTabAll"), count: channels.length },
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
              className="mb-0"
            />
          </ConfigSplitPaneHeader>

          <div className="border-b border-gray-100 px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("channelsFilterPlaceholder")}
                className="h-10 rounded-xl pl-9"
              />
            </div>
          </div>

          <ConfigSplitPaneBody className="space-y-2 p-3">
            {filteredChannels.map((channel) => {
              const enabled = Boolean(config.channels[channel.name]?.enabled);
              const tutorialUrl = resolveChannelTutorialUrl(channel);
              const description =
                hintForPath(`channels.${channel.name}`, schema?.uiHints)?.help ||
                t(channelDescriptionKeys[channel.name] || "channelDescriptionDefault");

              return (
                <ConfigSelectionCard
                  key={channel.name}
                  onClick={() => setSelectedChannel(channel.name)}
                  active={selectedChannel === channel.name}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <LogoBadge
                        name={channel.name}
                        src={getChannelLogo(channel.name)}
                        className={cn(
                          "h-10 w-10 rounded-lg border",
                          enabled ? "border-primary/30 bg-white" : "border-gray-200/70 bg-white",
                        )}
                        imgClassName="h-5 w-5 object-contain"
                        fallback={<span className="text-sm font-semibold uppercase text-gray-500">{channel.name[0]}</span>}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {channel.displayName || channel.name}
                        </p>
                        <p className="line-clamp-1 text-[11px] text-gray-500">{description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {tutorialUrl ? (
                        <a
                          href={tutorialUrl}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-300 transition-colors hover:bg-gray-100/70 hover:text-gray-500"
                          title={t("channelsGuideTitle")}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                      <StatusDot
                        status={enabled ? "active" : "inactive"}
                        label={enabled ? t("statusActive") : t("statusInactive")}
                        className="min-w-[56px] justify-center"
                      />
                    </div>
                  </div>
                </ConfigSelectionCard>
              );
            })}

            {filteredChannels.length === 0 ? (
              <ConfigSplitEmptyState icon={MessageSquare} title={t("channelsNoMatch")} />
            ) : null}
          </ConfigSplitPaneBody>
        </ConfigSplitSidebar>

        <ChannelForm channelName={selectedChannel} />
      </ConfigSplitPage>
    </PageLayout>
  );
}
