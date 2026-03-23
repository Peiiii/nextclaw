import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RemoteAccessPage } from '@/components/remote/RemoteAccessPage';
import { setLanguage } from '@/lib/i18n';
import { useRemoteAccessStore } from '@/remote/stores/remote-access.store';

const mocks = vi.hoisted(() => ({
  reauthorizeRemoteAccess: vi.fn(),
  repairRemoteAccess: vi.fn(),
  enableRemoteAccess: vi.fn(),
  disableRemoteAccess: vi.fn(),
  syncStatus: vi.fn(),
  openNextClawWeb: vi.fn(),
  statusQuery: {
    data: undefined as unknown,
    isLoading: false
  }
}));

vi.mock('@/hooks/useRemoteAccess', () => ({
  useRemoteStatus: () => mocks.statusQuery
}));

vi.mock('@/presenter/app-presenter-context', () => ({
  useAppPresenter: () => ({
    remoteAccessManager: {
      reauthorizeRemoteAccess: mocks.reauthorizeRemoteAccess,
      repairRemoteAccess: mocks.repairRemoteAccess,
      enableRemoteAccess: mocks.enableRemoteAccess,
      disableRemoteAccess: mocks.disableRemoteAccess,
      syncStatus: mocks.syncStatus
    },
    accountManager: {
      openNextClawWeb: mocks.openNextClawWeb
    }
  })
}));

describe('RemoteAccessPage', () => {
  beforeEach(() => {
    setLanguage('zh');
    mocks.reauthorizeRemoteAccess.mockReset();
    mocks.repairRemoteAccess.mockReset();
    mocks.enableRemoteAccess.mockReset();
    mocks.disableRemoteAccess.mockReset();
    mocks.syncStatus.mockReset();
    mocks.openNextClawWeb.mockReset();
    useRemoteAccessStore.setState({
      enabled: false,
      deviceName: '',
      platformApiBase: '',
      draftTouched: false,
      advancedOpen: false,
      actionLabel: null,
      doctor: null
    });
    mocks.statusQuery = {
      data: {
        account: {
          loggedIn: true,
          email: 'user@example.com',
          apiBase: 'https://ai-gateway-api.nextclaw.io/v1',
          platformBase: 'https://ai-gateway-api.nextclaw.io'
        },
        settings: {
          enabled: true,
          deviceName: 'MacBook Pro',
          platformApiBase: 'https://ai-gateway-api.nextclaw.io/v1'
        },
        service: {
          running: true,
          currentProcess: false
        },
        localOrigin: 'http://127.0.0.1:55667',
        configuredEnabled: true,
        platformBase: 'https://ai-gateway-api.nextclaw.io',
        runtime: {
          enabled: true,
          mode: 'service',
          state: 'error',
          lastError: 'Invalid or expired token.',
          updatedAt: '2026-03-23T00:00:00.000Z'
        }
      },
      isLoading: false
    };
  });

  it('shows a user-facing reauthorization flow instead of raw token errors', async () => {
    const user = userEvent.setup();

    render(<RemoteAccessPage />);

    expect(screen.getByText('登录已过期，请重新登录 NextClaw')).toBeTruthy();
    expect(screen.getByText('重新登录并恢复远程访问')).toBeTruthy();
    expect(screen.queryByText('Invalid or expired token.')).toBeNull();

    await user.click(screen.getByRole('button', { name: '重新登录并恢复远程访问' }));

    expect(mocks.reauthorizeRemoteAccess).toHaveBeenCalledTimes(1);
    expect(mocks.repairRemoteAccess).not.toHaveBeenCalled();
  });
});
