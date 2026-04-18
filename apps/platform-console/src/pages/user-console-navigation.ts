export type Translate = (key: string, params?: Record<string, string | number>) => string;

export type UserConsoleRouteKey = 'instances' | 'account';

export type UserConsoleRoute = {
  key: UserConsoleRouteKey;
  label: string;
  description: string;
  href: string;
};

const ACCOUNT_PATHS = new Set(['/account', '/profile']);

function normalizePathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed) {
    return '/';
  }
  return trimmed.replace(/\/+$/, '') || '/';
}

export function getUserConsoleRoutes(t: Translate): UserConsoleRoute[] {
  return [
    {
      key: 'instances',
      label: t('app.navigation.home'),
      description: t('app.routeDescriptions.instances'),
      href: '/'
    },
    {
      key: 'account',
      label: t('app.navigation.account'),
      description: t('app.routeDescriptions.account'),
      href: '/account'
    }
  ];
}

export function resolveUserConsoleRoute(pathname: string, routes: UserConsoleRoute[]): UserConsoleRoute {
  const normalizedPathname = normalizePathname(pathname);
  if (ACCOUNT_PATHS.has(normalizedPathname)) {
    return routes.find((route) => route.key === 'account') ?? routes[0];
  }
  return routes.find((route) => route.key === 'instances') ?? routes[0];
}
