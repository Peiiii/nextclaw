import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { RuntimeControlCard } from '@/components/config/runtime-control-card';
import { setLanguage } from '@/lib/i18n';

const baseControlView = {
  environment: 'managed-local-service' as const,
  lifecycle: 'healthy' as const,
  serviceState: 'running' as const,
  message: 'runtime healthy',
  pendingRestart: null,
  canStartService: {
    available: false,
    requiresConfirmation: false,
    impact: 'brief-ui-disconnect' as const,
    reasonIfUnavailable: '当前页面已经由运行中的本地服务托管。',
  },
  canRestartService: {
    available: true,
    requiresConfirmation: false,
    impact: 'brief-ui-disconnect' as const,
  },
  canStopService: {
    available: true,
    requiresConfirmation: true,
    impact: 'brief-ui-disconnect' as const,
  },
  canRestartApp: {
    available: false,
    requiresConfirmation: true,
    impact: 'full-app-relaunch' as const,
    reasonIfUnavailable: 'desktop only',
  },
  managementHint: 'This page is served by the running local service.',
};

const mocks = vi.hoisted(() => ({
  useRuntimeControlPanelView: vi.fn(),
  runRuntimeControlAction: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/features/system-status', () => ({
  useRuntimeControlPanelView: (...args: unknown[]) =>
    mocks.useRuntimeControlPanelView(...args),
  systemStatusManager: {
    runRuntimeControlAction: (...args: unknown[]) =>
      mocks.runRuntimeControlAction(...args),
  },
}));

describe('RuntimeControlCard', () => {
  beforeEach(() => {
    setLanguage('zh');
    vi.clearAllMocks();
    mocks.useRuntimeControlPanelView.mockReturnValue({
      controlView: baseControlView,
      visibleLifecycle: 'healthy',
      visibleServiceState: 'running',
      visibleMessage: 'runtime healthy',
      busyAction: null,
      busy: false,
      pendingRestart: null,
      errorMessage: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders service management actions from the current capability view', () => {
    render(<RuntimeControlCard />);

    const startButton = screen.getByRole('button', {
      name: '启动服务',
    }) as HTMLButtonElement;
    const restartAppButton = screen.getByRole('button', {
      name: '重启应用',
    }) as HTMLButtonElement;

    expect(screen.getByText('服务管理')).toBeTruthy();
    expect(screen.getByText('服务运行中')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重启服务' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '停止服务' })).toBeTruthy();
    expect(startButton.disabled).toBe(true);
    expect(restartAppButton.disabled).toBe(true);
    expect(screen.getByText('desktop only')).toBeTruthy();
  });

  it('runs the restart service flow through the system status manager', async () => {
    const user = userEvent.setup();
    mocks.runRuntimeControlAction.mockResolvedValue({
      accepted: true,
      action: 'restart-service',
      lifecycle: 'restarting-service',
      message: 'Restart scheduled. This page may disconnect for a few seconds.',
    });

    render(<RuntimeControlCard />);

    await user.click(screen.getByRole('button', { name: '重启服务' }));

    await waitFor(() => {
      expect(mocks.runRuntimeControlAction).toHaveBeenCalledWith(
        'restart-service'
      );
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Restart scheduled. This page may disconnect for a few seconds.'
    );
  });

  it('runs the stop service flow after confirmation', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mocks.runRuntimeControlAction.mockResolvedValue({
      accepted: true,
      action: 'stop-service',
      lifecycle: 'stopping-service',
      message: 'Stop scheduled. This page will disconnect shortly.',
    });

    render(<RuntimeControlCard />);

    await user.click(screen.getByRole('button', { name: '停止服务' }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(mocks.runRuntimeControlAction).toHaveBeenCalledWith(
        'stop-service'
      );
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Stop scheduled. This page will disconnect shortly.'
    );
  });

  it('runs the desktop restart app flow after confirmation', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mocks.useRuntimeControlPanelView.mockReturnValue({
      controlView: {
        ...baseControlView,
        environment: 'desktop-embedded',
        canStopService: {
          available: false,
          requiresConfirmation: true,
          impact: 'brief-ui-disconnect',
        },
        canRestartApp: {
          available: true,
          requiresConfirmation: true,
          impact: 'full-app-relaunch',
        },
        managementHint: 'desktop launcher hint',
      },
      visibleLifecycle: 'healthy',
      visibleServiceState: 'running',
      visibleMessage: 'runtime healthy',
      busyAction: null,
      busy: false,
      pendingRestart: null,
      errorMessage: null,
    });
    mocks.runRuntimeControlAction.mockResolvedValue({
      accepted: true,
      action: 'restart-app',
      lifecycle: 'restarting-app',
      message: 'NextClaw app restart scheduled.',
    });

    render(<RuntimeControlCard />);

    await user.click(screen.getByRole('button', { name: '重启应用' }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(mocks.runRuntimeControlAction).toHaveBeenCalledWith(
        'restart-app'
      );
    });
    expect(toast.success).toHaveBeenCalledWith(
      'NextClaw app restart scheduled.'
    );
  });

  it('shows a pending restart notice instead of auto-applying hidden restarts', () => {
    mocks.useRuntimeControlPanelView.mockReturnValue({
      controlView: {
        ...baseControlView,
        message: 'Saved changes are waiting for a manual restart.',
        pendingRestart: {
          changedPaths: ['plugins', 'ui'],
          message: 'Saved changes are waiting for a manual restart.',
          reasons: ['config reload requires restart: plugins, ui'],
          requestedAt: '2026-04-17T10:00:00.000Z',
        },
      },
      visibleLifecycle: 'healthy',
      visibleServiceState: 'running',
      visibleMessage: 'Saved changes are waiting for a manual restart.',
      busyAction: null,
      busy: false,
      pendingRestart: {
        changedPaths: ['plugins', 'ui'],
        message: 'Saved changes are waiting for a manual restart.',
        reasons: ['config reload requires restart: plugins, ui'],
        requestedAt: '2026-04-17T10:00:00.000Z',
      },
      errorMessage: null,
    });

    render(<RuntimeControlCard />);

    expect(screen.getByText('待重启')).toBeTruthy();
    expect(
      screen.getByText(
        '这次改动已经保存，但系统不会自动重启。请在你方便的时候手动重启，重启完成后该提示会自动清空。'
      )
    ).toBeTruthy();
    expect(screen.getByText('plugins')).toBeTruthy();
    expect(screen.getByText('ui')).toBeTruthy();
  });
});
