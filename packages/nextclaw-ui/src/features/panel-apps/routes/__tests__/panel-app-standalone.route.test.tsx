import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  PanelAppStandaloneRoute,
  readStandalonePanelAppId,
} from '@/features/panel-apps/routes/panel-app-standalone.route';

vi.mock('sonner', () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

vi.mock('@/shared/hooks/use-auth-status', () => ({
  isTransientAuthStatusBootstrapError: () => false,
  useAuthStatus: () => ({
    data: { authenticated: true, enabled: false },
    isError: false,
    isLoading: false,
  }),
}));

vi.mock('@/features/panel-apps/pages/panel-app-standalone-page', () => ({
  PanelAppStandalonePage: ({ appId }: { appId: string }) => (
    <main data-testid="standalone-panel-app" data-app-id={appId} />
  ),
}));

vi.mock('@/features/panel-apps/providers/panel-app-host.provider', () => ({
  PanelAppHostProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/features/panel-apps/components/panel-app-service-action-authorization-dialog', () => ({
  PanelAppServiceActionAuthorizationDialog: () => <div data-testid="authorization-dialog" />,
}));

describe('PanelAppStandaloneRoute', () => {
  it('parses only the dedicated standalone route', () => {
    expect(readStandalonePanelAppId('/apps/panel/publisher.todo/standalone')).toBe('publisher.todo');
    expect(readStandalonePanelAppId('/apps/panel/a%20b/standalone/')).toBe('a b');
    expect(readStandalonePanelAppId('/apps/panel/publisher.todo')).toBeNull();
  });

  it('renders the lightweight Panel host for the requested app', () => {
    render(<PanelAppStandaloneRoute pathname="/apps/panel/publisher.todo/standalone" />);

    expect(screen.getByTestId('standalone-panel-app').getAttribute('data-app-id'))
      .toBe('publisher.todo');
    expect(screen.getByTestId('authorization-dialog')).toBeTruthy();
    expect(screen.getByTestId('toaster')).toBeTruthy();
  });
});
