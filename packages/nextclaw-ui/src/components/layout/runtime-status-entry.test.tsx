import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { RuntimeStatusEntry } from '@/components/layout/runtime-status-entry';
import { setLanguage } from '@/lib/i18n';

const mocks = vi.hoisted(() => ({
  useRuntimeControl: vi.fn(),
  controlService: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('@/hooks/use-runtime-control', () => ({
  useRuntimeControl: (...args: unknown[]) => mocks.useRuntimeControl(...args)
}));

vi.mock('@/runtime-control/runtime-control.manager', () => ({
  runtimeControlManager: {
    controlService: (...args: unknown[]) => mocks.controlService(...args)
  }
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('RuntimeStatusEntry', () => {
  beforeEach(() => {
    setLanguage('zh');
    vi.clearAllMocks();
  });

  it('shows a compact pending-restart entry with reasons and a restart action', async () => {
    const queryClient = new QueryClient();
    const user = userEvent.setup();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    mocks.useRuntimeControl.mockReturnValue({
      data: {
        environment: 'managed-local-service',
        lifecycle: 'healthy',
        serviceState: 'running',
        message: 'runtime healthy',
        pendingRestart: {
          changedPaths: ['plugins', 'ui'],
          message: 'Saved changes are waiting for a manual restart.',
          reasons: ['config reload requires restart: plugins, ui'],
          requestedAt: '2026-04-17T12:00:00.000Z'
        },
        canStartService: {
          available: false,
          requiresConfirmation: false,
          impact: 'brief-ui-disconnect'
        },
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
          impact: 'full-app-relaunch'
        }
      },
      isError: false,
      error: null
    });
    mocks.controlService.mockResolvedValue({
      accepted: true,
      action: 'restart-service',
      lifecycle: 'restarting-service',
      message: 'Restart scheduled. This page may disconnect for a few seconds.'
    });

    render(<RuntimeStatusEntry />, {
      wrapper: createWrapper(queryClient)
    });

    await user.click(screen.getByTestId('runtime-status-entry'));

    expect(screen.getByText('待重启')).toBeTruthy();
    expect(screen.getByText('这些改动已经保存，但不会自动重启。你可以在这里查看原因，并在方便的时候手动重启。')).toBeTruthy();
    expect(screen.getByText('plugins 改动将在重启后生效。')).toBeTruthy();
    expect(screen.getByText('ui 改动将在重启后生效。')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '立即重启' }));

    await waitFor(() => {
      expect(mocks.controlService).toHaveBeenCalledWith('restart-service');
    });
    expect(toast.success).toHaveBeenCalledWith('Restart scheduled. This page may disconnect for a few seconds.');
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['runtime-control'] });
  });

  it('shows a healthy status without restart controls when no action is needed', async () => {
    const queryClient = new QueryClient();
    const user = userEvent.setup();

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
          impact: 'brief-ui-disconnect'
        },
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
          impact: 'full-app-relaunch'
        }
      },
      isError: false,
      error: null
    });

    render(<RuntimeStatusEntry />, {
      wrapper: createWrapper(queryClient)
    });

    await user.click(screen.getByTestId('runtime-status-entry'));

    expect(screen.getByText('系统正常')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '立即重启' })).toBeNull();
  });
});
