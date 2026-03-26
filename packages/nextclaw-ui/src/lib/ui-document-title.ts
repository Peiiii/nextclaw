import { t } from '@/lib/i18n';

const PRODUCT = 'NextClaw';

const ROUTE_TITLE_KEYS: Array<{ prefix: string; key: string }> = [
  { prefix: '/marketplace/mcp', key: 'marketplaceMcpPageTitle' },
  { prefix: '/marketplace/plugins', key: 'marketplacePluginsPageTitle' },
  { prefix: '/marketplace/skills', key: 'marketplaceSkillsPageTitle' },
  { prefix: '/marketplace', key: 'marketplace' },
  { prefix: '/skills', key: 'marketplaceSkillsPageTitle' },
  { prefix: '/cron', key: 'cronPageTitle' },
  { prefix: '/chat', key: 'chat' },
  { prefix: '/model', key: 'modelPageTitle' },
  { prefix: '/search', key: 'searchPageTitle' },
  { prefix: '/providers', key: 'providersPageTitle' },
  { prefix: '/channels', key: 'channelsPageTitle' },
  { prefix: '/runtime', key: 'runtimePageTitle' },
  { prefix: '/remote', key: 'remotePageTitle' },
  { prefix: '/security', key: 'authSecurityTitle' },
  { prefix: '/sessions', key: 'sessionsPageTitle' },
  { prefix: '/secrets', key: 'secretsPageTitle' }
];

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function segmentTitle(pathname: string): string {
  const p = pathname.toLowerCase();
  for (const { prefix, key } of ROUTE_TITLE_KEYS) {
    if (pathMatchesPrefix(p, prefix)) {
      return t(key);
    }
  }
  return t('settings');
}

/** Browser tab / window title; kept in sync with the active UI route. */
export function resolveUiDocumentTitle(pathname: string): string {
  return `${PRODUCT} - ${segmentTitle(pathname)}`;
}
