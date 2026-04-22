import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RuntimePresenceCard } from './runtime-presence-card';
import { setLanguage } from '@/shared/lib/i18n';
import { useDesktopPresenceStore } from '@/platforms/desktop';

const mocks = vi.hoisted(() => ({
  useSystemStatus: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn()
}));

vi.mock('@/features/system-status', () => ({
  useSystemStatus: (...args: unknown[]) => mocks.useSystemStatus(...args)
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    error: (...args: unknown[]) => mocks.toastError(...args)
  }
}));

describe('RuntimePresenceCard', () => {
  beforeEach(() => {
    setLanguage('zh');
    vi.clearAllMocks();
    useDesktopPresenceStore.setState({
      supported: false,
      initialized: false,
      busyAction: null,
      snapshot: null
    });
    mocks.useSystemStatus.mockReturnValue({
      runtimeControlView: {
        environment: 'managed-local-service',
        lifecycle: 'healthy',
        serviceState: 'running',
        canStartService: {
          available: false,
          requiresConfirmation: false,
          impact: 'brief-ui-disconnect',
          reasonIfUnavailable: 'running local service'
        },
        message: 'runtime healthy',
        canRestartService: {
          available: true,
          requiresConfirmation: false,
          impact: 'brief-ui-disconnect'
        },
        canStopService: {
          available: true,
          requiresConfirmation: true,
          impact: 'brief-ui-disconnect'
        },
        canRestartApp: {
          available: false,
          requiresConfirmation: true,
          impact: 'full-app-relaunch',
          reasonIfUnavailable: 'desktop only'
        },
        managementHint: 'managed service hint'
      }
    });
    window.nextclawDesktop = undefined;
  });

  it('explains that closing the browser does not stop the managed local service', () => {
    render(<RuntimePresenceCard />);

    expect(screen.getByText('浏览器只是本地服务控制面')).toBeTruthy();
    expect(screen.getByText('关闭浏览器标签页不会停止本地 NextClaw 服务。服务生命周期由本地受管服务负责，而不是由页面生命周期决定。')).toBeTruthy();
  });

  it('loads desktop presence settings and updates close-to-background preference', async () => {
    const user = userEvent.setup();
    const getPresenceState = vi.fn().mockResolvedValue({
      closeToBackground: true,
      launchAtLogin: false,
      supportsLaunchAtLogin: true,
      launchAtLoginReason: null
    });
    const updatePresencePreferences = vi.fn().mockResolvedValue({
      closeToBackground: false,
      launchAtLogin: false,
      supportsLaunchAtLogin: true,
      launchAtLoginReason: null
    });

    window.nextclawDesktop = {
      platform: 'darwin',
      version: '32.2.1',
      getUpdateState: vi.fn(),
      checkForUpdates: vi.fn(),
      downloadUpdate: vi.fn(),
      applyDownloadedUpdate: vi.fn(),
      updatePreferences: vi.fn(),
      updateChannel: vi.fn(),
      restartService: vi.fn(),
      restartApp: vi.fn(),
      getPresenceState,
      updatePresencePreferences,
      onUpdateStateChanged: vi.fn(() => () => {})
    };

    mocks.useSystemStatus.mockReturnValue({
      runtimeControlView: {
        environment: 'desktop-embedded',
        lifecycle: 'healthy',
        serviceState: 'running',
        canStartService: {
          available: false,
          requiresConfirmation: false,
          impact: 'none'
        },
        message: 'runtime healthy',
        canRestartService: {
          available: true,
          requiresConfirmation: false,
          impact: 'brief-ui-disconnect'
        },
        canStopService: {
          available: false,
          requiresConfirmation: true,
          impact: 'brief-ui-disconnect'
        },
        canRestartApp: {
          available: true,
          requiresConfirmation: true,
          impact: 'full-app-relaunch'
        },
        managementHint: 'desktop hint'
      }
    });

    render(<RuntimePresenceCard />);

    await waitFor(() => {
      expect(getPresenceState).toHaveBeenCalledTimes(1);
      expect(screen.getByText('关闭窗口时隐藏到后台')).toBeTruthy();
    });

    await user.click(screen.getByRole('switch', { name: '关闭窗口时继续在后台运行' }));

    await waitFor(() => {
      expect(updatePresencePreferences).toHaveBeenCalledWith({ closeToBackground: false });
    });
  });
});
