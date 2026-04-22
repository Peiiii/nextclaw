import { lazy, Suspense, useEffect } from "react";
import type { ReactElement } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { appQueryClient } from "@/app-query-client";
import { AppManagerProvider } from "@/app/components/app-manager-provider";
import { AppLayout } from "@/app/components/layout/app-layout";
import { SettingsEntryPage } from "@/app/components/layout/settings-entry-page";
import { LoginPage } from "@/components/auth/login-page";
import { AccountPanel } from "@/features/account";
import { useSystemStatusSources } from "@/features/system-status";
import {
  isTransientAuthStatusBootstrapError,
  useAuthStatus,
} from "@/hooks/use-auth";
import { useRealtimeQueryBridge } from "@/hooks/use-realtime-query-bridge";
import {
  PwaInstallBanner,
  PwaUpdateBanner,
} from "@/pwa/components/pwa-install-entry";
import { startNextClawPwa } from "@/pwa/register-pwa";

const ModelConfigPage = lazy(async () => ({
  default: (await import("@/components/config/ModelConfig")).ModelConfig,
}));
const ChatPage = lazy(async () => ({
  default: (await import("@/components/chat/chat-page")).ChatPage,
}));
const SearchConfigPage = lazy(async () => ({
  default: (await import("@/components/config/SearchConfig")).SearchConfig,
}));
const ProvidersListPage = lazy(async () => ({
  default: (await import("@/components/config/ProvidersList")).ProvidersList,
}));
const ChannelsListPage = lazy(async () => ({
  default: (await import("@/components/config/ChannelsList")).ChannelsList,
}));
const RuntimeConfigPage = lazy(async () => ({
  default: (await import("@/components/config/RuntimeConfig")).RuntimeConfig,
}));
const DesktopUpdateConfigPage = lazy(async () => ({
  default: (await import("@/components/config/desktop-update-config"))
    .DesktopUpdateConfig,
}));
const SecurityConfigPage = lazy(async () => ({
  default: (await import("@/components/config/security-config")).SecurityConfig,
}));
const SessionsConfigPage = lazy(async () => ({
  default: (await import("@/components/config/SessionsConfig")).SessionsConfig,
}));
const SecretsConfigPage = lazy(async () => ({
  default: (await import("@/components/config/SecretsConfig")).SecretsConfig,
}));
const RemoteAccessPage = lazy(async () => ({
  default: (await import("@/features/remote")).RemoteAccessPage,
}));
const MarketplacePage = lazy(async () => ({
  default: (await import("@/components/marketplace/marketplace-page"))
    .MarketplacePage,
}));
const McpMarketplacePage = lazy(async () => ({
  default: (await import("@/components/marketplace/mcp/mcp-marketplace-page"))
    .McpMarketplacePage,
}));

type RedirectRouteDefinition = {
  path: string;
  redirectTo: string;
};

type ElementRouteDefinition = {
  path: string;
  element: ReactElement;
};

type ProtectedRouteDefinition =
  | RedirectRouteDefinition
  | ElementRouteDefinition;

function RouteFallback() {
  return (
    <div className="h-full w-full animate-pulse rounded-2xl border border-border/40 bg-card/40" />
  );
}

function LazyRoute({ children }: { children: ReactElement }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function createLazyElement(element: ReactElement): ReactElement {
  return <LazyRoute>{element}</LazyRoute>;
}

const protectedRouteDefinitions: ProtectedRouteDefinition[] = [
  { path: "/chat/skills", redirectTo: "/skills" },
  { path: "/chat/cron", redirectTo: "/cron" },
  { path: "/chat/agents", redirectTo: "/agents" },
  {
    path: "/chat/:sessionId?",
    element: createLazyElement(<ChatPage view="chat" />),
  },
  {
    path: "/agents",
    element: createLazyElement(<ChatPage view="agents" />),
  },
  {
    path: "/skills",
    element: createLazyElement(<ChatPage view="skills" />),
  },
  {
    path: "/cron",
    element: createLazyElement(<ChatPage view="cron" />),
  },
  {
    path: "/model",
    element: createLazyElement(<ModelConfigPage />),
  },
  {
    path: "/search",
    element: createLazyElement(<SearchConfigPage />),
  },
  {
    path: "/providers",
    element: createLazyElement(<ProvidersListPage />),
  },
  {
    path: "/channels",
    element: createLazyElement(<ChannelsListPage />),
  },
  {
    path: "/runtime",
    element: createLazyElement(<RuntimeConfigPage />),
  },
  {
    path: "/updates",
    element: createLazyElement(<DesktopUpdateConfigPage />),
  },
  {
    path: "/remote",
    element: createLazyElement(<RemoteAccessPage />),
  },
  {
    path: "/security",
    element: createLazyElement(<SecurityConfigPage />),
  },
  {
    path: "/sessions",
    element: createLazyElement(<SessionsConfigPage />),
  },
  {
    path: "/secrets",
    element: createLazyElement(<SecretsConfigPage />),
  },
  {
    path: "/settings",
    element: <SettingsEntryPage />,
  },
  {
    path: "/marketplace/skills",
    redirectTo: "/skills",
  },
  {
    path: "/marketplace",
    redirectTo: "/marketplace/plugins",
  },
  {
    path: "/marketplace/mcp",
    element: createLazyElement(<McpMarketplacePage />),
  },
  {
    path: "/marketplace/:type",
    element: createLazyElement(<MarketplacePage />),
  },
  {
    path: "/",
    redirectTo: "/chat",
  },
  {
    path: "*",
    redirectTo: "/chat",
  },
];

function renderProtectedRoute(definition: ProtectedRouteDefinition) {
  if ("redirectTo" in definition) {
    return (
      <Route
        key={definition.path}
        path={definition.path}
        element={<Navigate to={definition.redirectTo} replace />}
      />
    );
  }

  return (
    <Route
      key={definition.path}
      path={definition.path}
      element={definition.element}
    />
  );
}

function ProtectedRoutes() {
  return <Routes>{protectedRouteDefinitions.map(renderProtectedRoute)}</Routes>;
}

function ProtectedApp() {
  useRealtimeQueryBridge(appQueryClient);
  useSystemStatusSources();

  return (
    <AppManagerProvider>
      <AppLayout>
        <ProtectedRoutes />
      </AppLayout>
      <AccountPanel />
    </AppManagerProvider>
  );
}

function AuthGate() {
  const authStatus = useAuthStatus();
  const isTransientBootstrapFailure =
    authStatus.isError && isTransientAuthStatusBootstrapError(authStatus.error);

  if (
    (authStatus.isLoading && !authStatus.isError) ||
    isTransientBootstrapFailure ||
    authStatus.isError
  ) {
    return <ProtectedApp />;
  }

  if (authStatus.data?.enabled && !authStatus.data.authenticated) {
    return <LoginPage username={authStatus.data.username} />;
  }

  return <ProtectedApp />;
}

export default function AppContent() {
  useEffect(() => {
    startNextClawPwa();
  }, []);

  return (
    <QueryClientProvider client={appQueryClient}>
      <AuthGate />
      <PwaInstallBanner />
      <PwaUpdateBanner />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
