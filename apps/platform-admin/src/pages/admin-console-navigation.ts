import { useSyncExternalStore } from 'react';

export type AdminConsoleRouteKey = 'overview' | 'marketplace' | 'marketplace-apps' | 'users' | 'recharge';

export type AdminConsoleRoute = {
  key: AdminConsoleRouteKey;
  label: string;
  description: string;
  hash: string;
};

const DEFAULT_ROUTE_KEY: AdminConsoleRouteKey = 'overview';

export const ADMIN_CONSOLE_ROUTES: AdminConsoleRoute[] = [
  {
    key: 'overview',
    label: '总览',
    description: '平台治理入口与关键运行状态。',
    hash: '#/overview'
  },
  {
    key: 'marketplace',
    label: 'Marketplace 审核',
    description: '集中查看待审核 skill，并直接通过或拒绝。',
    hash: '#/marketplace'
  },
  {
    key: 'marketplace-apps',
    label: 'Apps 审核',
    description: '集中查看待审核 app，并直接通过或拒绝。',
    hash: '#/marketplace-apps'
  },
  {
    key: 'users',
    label: '用户与额度',
    description: '统一管理免费池、用户额度和付费余额。',
    hash: '#/users'
  },
  {
    key: 'recharge',
    label: '充值审核',
    description: '处理平台充值申请与待办状态。',
    hash: '#/recharge'
  }
];

function getDefaultRoute(): AdminConsoleRoute {
  return ADMIN_CONSOLE_ROUTES[0];
}

function normalizeHash(hash: string): string {
  const raw = hash.trim().replace(/^#/, '');
  if (!raw) {
    return '/overview';
  }
  if (raw.startsWith('/')) {
    return raw;
  }
  return `/${raw}`;
}

function resolveRouteFromHash(hash: string): AdminConsoleRoute {
  const normalizedHash = normalizeHash(hash);
  return ADMIN_CONSOLE_ROUTES.find((route) => normalizeHash(route.hash) === normalizedHash) ?? getDefaultRoute();
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  window.addEventListener('hashchange', onStoreChange);
  return () => window.removeEventListener('hashchange', onStoreChange);
}

function readCurrentRouteKey(): AdminConsoleRouteKey {
  if (typeof window === 'undefined') {
    return DEFAULT_ROUTE_KEY;
  }
  return resolveRouteFromHash(window.location.hash).key;
}

export function useAdminConsoleRoute(): AdminConsoleRoute {
  const currentRouteKey = useSyncExternalStore(subscribe, readCurrentRouteKey, () => DEFAULT_ROUTE_KEY);
  return getAdminConsoleRoute(currentRouteKey);
}

export function getAdminConsoleRoute(routeKey: AdminConsoleRouteKey): AdminConsoleRoute {
  return ADMIN_CONSOLE_ROUTES.find((route) => route.key === routeKey) ?? getDefaultRoute();
}

export function getAdminConsoleHref(routeKey: AdminConsoleRouteKey): string {
  return getAdminConsoleRoute(routeKey).hash;
}
