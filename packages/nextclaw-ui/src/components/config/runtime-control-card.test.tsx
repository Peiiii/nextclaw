import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { RuntimeControlCard } from '@/components/config/runtime-control-card';
import { setLanguage } from '@/lib/i18n';

const mocks = vi.hoisted(() => ({
  useRuntimeControl: vi.fn(),
  useRuntimeServiceAction: vi.fn(),
  waitForRecovery: vi.fn(),
  restartApp: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/hooks/use-runtime-control', () => ({
  useRuntimeControl: (...args: unknown[]) => mocks.useRuntimeControl(...args),
  useRuntimeServiceAction: (...args: unknown[]) => mocks.useRuntimeServiceAction(...args),
}));

vi.mock('@/runtime-control/runtime-control.manager', () => ({
  runtimeControlManager: {
    waitForRecovery: (...args: unknown[]) => mocks.waitForRecovery(...args),
    restartApp: (...args: unknown[]) => mocks.restartApp(...args),
  },
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('RuntimeControlCard', () => {
  beforeEach(() => {
    setLanguage('zh');
    vi.clearAllMocks();
    mocks.useRuntimeControl.mockReturnValue({
      data: {
        environment: 'managed-local-service',
        lifecycle: 'healthy',
        serviceState: 'running',
        message: 'runtime healthy',
        pendingRestart: null,
        canStartService: {
          available: false,
          requiresConfirmation: false,
          impact: 'brief-ui-disconnect',
          reasonIfUnavailable: '当前页面已经由运行中的本地服务托管。'
        },
        canRestartService: {
          available: true,
          requiresConfirmation: false,
          impact: 'brief-ui-disconnect',
        },
        canStopService: {
          available: true,
          requiresConfirmation: true,
          impact: 'brief-ui-disconnect',
        },
        canRestartApp: {
          available: false,
          requiresConfirmation: true,
          impact: 'full-app-relaunch',
          reasonIfUnavailable: 'desktop only',
        },
        managementHint: 'This page is served by the running local service.'
      },
      isError: false,
      error: null,
    });
    mocks.useRuntimeServiceAction.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        accepted: true,
        action: 'restart-service',
        lifecycle: 'restarting-service',
        message: 'Restart scheduled. This page may disconnect for a few seconds.',
      }),
      isPending: false,
    });
    mocks.waitForRecovery.mockResolvedValue({
      environment: 'managed-local-service',
      lifecycle: 'healthy',
      serviceState: 'running',
      message: 'runtime healthy',
      pendingRestart: null,
      canStartService: {
        available: false,
        requiresConfirmation: false,
        impact: 'brief-ui-disconnect',
        reasonIfUnavailable: '当前页面已经由运行中的本地服务托管。'
      },
      canRestartService: {
        available: true,
        requiresConfirmation: false,
        impact: 'brief-ui-disconnect',
      },
      canStopService: {
        available: true,
        requiresConfirmation: true,
        impact: 'brief-ui-disconnect',
      },
      canRestartApp: {
        available: false,
        requiresConfirmation: true,
        impact: 'full-app-relaunch',
        reasonIfUnavailable: 'desktop only',
      },
      managementHint: 'This page is served by the running local service.'
    });
    mocks.restartApp.mockResolvedValue({
      accepted: true,
      action: 'restart-app',
      lifecycle: 'restarting-app',
      message: 'NextClaw app restart scheduled.',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders service management actions from the current capability view', () => {
    const queryClient = new QueryClient();

    render(<RuntimeControlCard />, {
      wrapper: createWrapper(queryClient),
    });

    const startButton = screen.getByRole('button', { name: '启动服务' }) as HTMLButtonElement;
    const restartAppButton = screen.getByRole('button', { name: '重启应用' }) as HTMLButtonElement;
    expect(screen.getByText('服务管理')).toBeTruthy();
    expect(screen.getByText('服务运行中')).toBeTruthy();
    expect(screen.getByRole('button', { name: '重启服务' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '停止服务' })).toBeTruthy();
    expect(startButton.disabled).toBe(true);
    expect(restartAppButton.disabled).toBe(true);
    expect(screen.getByText('desktop only')).toBeTruthy();
  });

  it('runs the restart service flow and waits for recovery', async () => {
    const queryClient = new QueryClient();
    const user = userEvent.setup();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const mutateAsync = vi.fn().mockResolvedValue({
      accepted: true,
      action: 'restart-service',
      lifecycle: 'restarting-service',
      message: 'Restart scheduled. This page may disconnect for a few seconds.',
    });
    mocks.useRuntimeServiceAction.mockReturnValue({
      mutateAsync,
      isPending: false,
    });

    render(<RuntimeControlCard />, {
      wrapper: createWrapper(queryClient),
    });

    await user.click(screen.getByRole('button', { name: '重启服务' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith('restart-service');
      expect(mocks.waitForRecovery).toHaveBeenCalledTimes(1);
    });
    expect(toast.success).toHaveBeenCalledWith('Restart scheduled. This page may disconnect for a few seconds.');
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['runtime-control'] });
  });

  it('runs the stop service flow after confirmation', async () => {
    const queryClient = new QueryClient();
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({
      accepted: true,
      action: 'stop-service',
      lifecycle: 'stopping-service',
      message: 'Stop scheduled. This page will disconnect shortly.',
    });
    mocks.useRuntimeServiceAction.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<RuntimeControlCard />, {
      wrapper: createWrapper(queryClient),
    });

    await user.click(screen.getByRole('button', { name: '停止服务' }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(mutateAsync).toHaveBeenCalledWith('stop-service');
    });
    expect(mocks.waitForRecovery).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Stop scheduled. This page will disconnect shortly.');
  });

  it('runs the desktop restart app flow after confirmation', async () => {
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    mocks.useRuntimeControl.mockReturnValue({
      data: {
        environment: 'desktop-embedded',
        lifecycle: 'healthy',
        serviceState: 'running',
        message: 'runtime healthy',
        pendingRestart: null,
        canStartService: {
          available: false,
          requiresConfirmation: false,
          impact: 'none',
        },
        canRestartService: {
          available: true,
          requiresConfirmation: false,
          impact: 'brief-ui-disconnect',
        },
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
        managementHint: 'desktop launcher hint'
      },
      isError: false,
      error: null,
    });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<RuntimeControlCard />, {
      wrapper: createWrapper(queryClient),
    });

    await user.click(screen.getByRole('button', { name: '重启应用' }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(mocks.restartApp).toHaveBeenCalledTimes(1);
    });
    expect(toast.success).toHaveBeenCalledWith('NextClaw app restart scheduled.');
  });

  it('shows a pending restart notice instead of auto-applying hidden restarts', () => {
    const queryClient = new QueryClient();

    mocks.useRuntimeControl.mockReturnValue({
      data: {
        environment: 'managed-local-service',
        lifecycle: 'healthy',
        serviceState: 'running',
        message: 'Saved changes are waiting for a manual restart.',
        pendingRestart: {
          changedPaths: ['plugins', 'ui'],
          message: 'Saved changes are waiting for a manual restart.',
          reasons: ['config reload requires restart: plugins, ui'],
          requestedAt: '2026-04-17T10:00:00.000Z'
        },
        canStartService: {
          available: false,
          requiresConfirmation: false,
          impact: 'brief-ui-disconnect',
          reasonIfUnavailable: '当前页面已经由运行中的本地服务托管。'
        },
        canRestartService: {
          available: true,
          requiresConfirmation: false,
          impact: 'brief-ui-disconnect',
        },
        canStopService: {
          available: true,
          requiresConfirmation: true,
          impact: 'brief-ui-disconnect',
        },
        canRestartApp: {
          available: false,
          requiresConfirmation: true,
          impact: 'full-app-relaunch',
          reasonIfUnavailable: 'desktop only',
        },
        managementHint: 'This page is served by the running local service.'
      },
      isError: false,
      error: null,
    });

    render(<RuntimeControlCard />, {
      wrapper: createWrapper(queryClient),
    });

    expect(screen.getByText('待重启')).toBeTruthy();
    expect(screen.getByText('这次改动已经保存，但系统不会自动重启。请在你方便的时候手动重启，重启完成后该提示会自动清空。')).toBeTruthy();
    expect(screen.getByText('plugins')).toBeTruthy();
    expect(screen.getByText('ui')).toBeTruthy();
  });
});
