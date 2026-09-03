import zhAgents from '@/shared/lib/i18n/locales/zh-CN/agents.json';
import zhChannelAuth from '@/shared/lib/i18n/locales/zh-CN/channel-auth.json';
import zhChannels from '@/shared/lib/i18n/locales/zh-CN/channels.json';
import zhChat from '@/shared/lib/i18n/locales/zh-CN/chat.json';
import zhCore from '@/shared/lib/i18n/locales/zh-CN/core.json';
import zhCron from '@/shared/lib/i18n/locales/zh-CN/cron.json';
import zhDesktopUpdate from '@/shared/lib/i18n/locales/zh-CN/desktop-update.json';
import zhDocBrowser from '@/shared/lib/i18n/locales/zh-CN/doc-browser.json';
import zhPanelApp from '@/shared/lib/i18n/locales/zh-CN/panel-app.json';
import zhInbox from '@/shared/lib/i18n/locales/zh-CN/inbox.json';
import zhMarketplace from '@/shared/lib/i18n/locales/zh-CN/marketplace.json';
import zhPathPicker from '@/shared/lib/i18n/locales/zh-CN/path-picker.json';
import zhProjects from '@/shared/lib/i18n/locales/zh-CN/projects.json';
import zhPwa from '@/shared/lib/i18n/locales/zh-CN/pwa.json';
import zhRemote from '@/shared/lib/i18n/locales/zh-CN/remote.json';
import zhRuntimeControl from '@/shared/lib/i18n/locales/zh-CN/runtime-control.json';
import zhSearch from '@/shared/lib/i18n/locales/zh-CN/search.json';
import enAgents from '@/shared/lib/i18n/locales/en-US/agents.json';
import enChannelAuth from '@/shared/lib/i18n/locales/en-US/channel-auth.json';
import enChannels from '@/shared/lib/i18n/locales/en-US/channels.json';
import enChat from '@/shared/lib/i18n/locales/en-US/chat.json';
import enCore from '@/shared/lib/i18n/locales/en-US/core.json';
import enCron from '@/shared/lib/i18n/locales/en-US/cron.json';
import enDesktopUpdate from '@/shared/lib/i18n/locales/en-US/desktop-update.json';
import enDocBrowser from '@/shared/lib/i18n/locales/en-US/doc-browser.json';
import enPanelApp from '@/shared/lib/i18n/locales/en-US/panel-app.json';
import enInbox from '@/shared/lib/i18n/locales/en-US/inbox.json';
import enMarketplace from '@/shared/lib/i18n/locales/en-US/marketplace.json';
import enPathPicker from '@/shared/lib/i18n/locales/en-US/path-picker.json';
import enProjects from '@/shared/lib/i18n/locales/en-US/projects.json';
import enPwa from '@/shared/lib/i18n/locales/en-US/pwa.json';
import enRemote from '@/shared/lib/i18n/locales/en-US/remote.json';
import enRuntimeControl from '@/shared/lib/i18n/locales/en-US/runtime-control.json';
import enSearch from '@/shared/lib/i18n/locales/en-US/search.json';
import { registerI18nCatalogs } from '@/shared/lib/i18n';

export function installMainI18nCatalog(): void {
  registerI18nCatalogs({
    zh: {
      ...zhCore,
      ...zhDesktopUpdate,
      ...zhSearch,
      ...zhChannels,
      ...zhCron,
      ...zhRemote,
      ...zhRuntimeControl,
      ...zhChat,
      ...zhAgents,
      ...zhMarketplace,
      ...zhInbox,
      ...zhDocBrowser,
      ...zhPanelApp,
      ...zhPathPicker,
      ...zhPwa,
      ...zhChannelAuth,
      ...zhProjects,
    },
    en: {
      ...enCore,
      ...enDesktopUpdate,
      ...enSearch,
      ...enChannels,
      ...enCron,
      ...enRemote,
      ...enRuntimeControl,
      ...enChat,
      ...enAgents,
      ...enMarketplace,
      ...enInbox,
      ...enDocBrowser,
      ...enPanelApp,
      ...enPathPicker,
      ...enPwa,
      ...enChannelAuth,
      ...enProjects,
    },
  });
}
