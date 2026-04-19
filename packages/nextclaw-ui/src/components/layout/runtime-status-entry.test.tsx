import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { RuntimeStatusEntry } from '@/components/layout/runtime-status-entry';
import { setLanguage } from '@/lib/i18n';

const mocks = vi.hoisted(() => ({
  useRuntimeStatusBadgeView: vi.fn(),
  runRuntimeControlAction: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/system-status/hooks/use-system-status', () => ({
  useRuntimeStatusBadgeView: (...args: unknown[]) =>
    mocks.useRuntimeStatusBadgeView(...args),
}));

vi.mock('@/system-status/system-status.manager', () => ({
  systemStatusManager: {
    runRuntimeControlAction: (...args: unknown[]) =>
      mocks.runRuntimeControlAction(...args),
  },
}));

describe('RuntimeStatusEntry', () => {
  beforeEach(() => {
    setLanguage('zh');
    vi.clearAllMocks();
  });

  it('shows a compact pending-restart entry with reasons and a restart action', async () => {
    const user = userEvent.setup();

    mocks.useRuntimeStatusBadgeView.mockReturnValue({
      tone: 'attention',
      title: '待重启',
      description:
        '这些改动已经保存，但不会自动重启。你可以在这里查看原因，并在方便的时候手动重启。',
      reasonLines: [
        'plugins 改动将在重启后生效。',
        'ui 改动将在重启后生效。',
      ],
      actionLabel: '立即重启',
      isBusy: false,
    });
    mocks.runRuntimeControlAction.mockResolvedValue({
      accepted: true,
      action: 'restart-service',
      lifecycle: 'restarting-service',
      message: 'Restart scheduled. This page may disconnect for a few seconds.',
    });

    render(<RuntimeStatusEntry />);

    await user.click(screen.getByTestId('runtime-status-entry'));

    expect(screen.getByText('待重启')).toBeTruthy();
    expect(
      screen.getByText(
        '这些改动已经保存，但不会自动重启。你可以在这里查看原因，并在方便的时候手动重启。'
      )
    ).toBeTruthy();
    expect(screen.getByText('plugins 改动将在重启后生效。')).toBeTruthy();
    expect(screen.getByText('ui 改动将在重启后生效。')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '立即重启' }));

    await waitFor(() => {
      expect(mocks.runRuntimeControlAction).toHaveBeenCalledWith(
        'restart-service'
      );
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Restart scheduled. This page may disconnect for a few seconds.'
    );
  });

  it('shows a healthy status without restart controls when no action is needed', async () => {
    const user = userEvent.setup();

    mocks.useRuntimeStatusBadgeView.mockReturnValue({
      tone: 'healthy',
      title: '系统正常',
      description: '所有系统状态都正常。',
      reasonLines: [],
      actionLabel: null,
      isBusy: false,
    });

    render(<RuntimeStatusEntry />);

    await user.click(screen.getByTestId('runtime-status-entry'));

    expect(screen.getByText('系统正常')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '立即重启' })).toBeNull();
  });
});
