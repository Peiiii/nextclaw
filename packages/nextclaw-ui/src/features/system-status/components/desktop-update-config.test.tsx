import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRuntimeUpdateStore } from '@/features/system-status';
import { DesktopUpdateConfig } from '@/features/system-status/components/desktop-update-config';
import { setLanguage } from '@/shared/lib/i18n';

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  applyDownloadedUpdate: vi.fn(),
  updatePreferences: vi.fn(),
  updateChannel: vi.fn()
}));

vi.mock('@/features/system-status', async () => {
  const actual = await vi.importActual<typeof import('@/features/system-status')>(
    '@/features/system-status'
  );
  return {
    ...actual,
    runtimeUpdateManager: mocks,
  };
});

describe('DesktopUpdateConfig', () => {
  beforeEach(() => {
    setLanguage('zh');
    mocks.start.mockReset();
    mocks.stop.mockReset();
    mocks.checkForUpdates.mockReset();
    mocks.downloadUpdate.mockReset();
    mocks.applyDownloadedUpdate.mockReset();
    mocks.updatePreferences.mockReset();
    mocks.updateChannel.mockReset();

    if (!HTMLElement.prototype.hasPointerCapture) {
      HTMLElement.prototype.hasPointerCapture = () => false;
    }
    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = () => {};
    }
    if (!HTMLElement.prototype.releasePointerCapture) {
      HTMLElement.prototype.releasePointerCapture = () => {};
    }

    useRuntimeUpdateStore.setState({
      supported: true,
      initialized: true,
      busyAction: null,
      snapshot: {
        status: 'idle',
        installationKind: 'npm-runtime-bundle',
        channel: 'beta',
        hostVersion: '0.0.138',
        currentVersion: '0.18.0',
        availableVersion: '0.18.2-beta.1',
        downloadedVersion: null,
        minimumHostVersion: null,
        releaseNotesUrl: 'https://example.com/release-notes',
        lastCheckedAt: '2026-04-13T12:00:00.000Z',
        progress: null,
        canAutoDownload: false,
        canApplyInApp: false,
        requiresRestart: false,
        blockReason: null,
        recoveryCommand: null,
        errorMessage: null,
        preferences: {
          automaticChecks: true,
          autoDownload: false
        }
      }
    });
  });

  it('renders current channel information and beta guidance', () => {
    render(<DesktopUpdateConfig />);

    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.stop).not.toHaveBeenCalled();
    expect(screen.getByText('版本更新')).toBeTruthy();
    expect(screen.getByText('宿主版本')).toBeTruthy();
    expect(screen.getByText('当前更新通道')).toBeTruthy();
    expect(screen.getAllByText('Beta').length).toBeGreaterThan(0);
    expect(screen.getByText('当前正在跟随 Beta 通道')).toBeTruthy();
    expect(screen.getByText('切回 Stable 后不会立刻强制降级；只有当 Stable 追平或超过当前版本时，才会继续提供 Stable 更新。')).toBeTruthy();
  });

  it('sends the newly selected release channel to the desktop update manager', async () => {
    const user = userEvent.setup();

    render(<DesktopUpdateConfig />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Stable' }));

    expect(mocks.updateChannel).toHaveBeenCalledWith('stable');
  });

  it('renders runtime download progress from the shared store', () => {
    useRuntimeUpdateStore.setState((state) => ({
      ...state,
      busyAction: 'downloading',
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            status: 'downloading',
            progress: {
              downloadedBytes: 50,
              totalBytes: 100,
              percent: 50
            }
          }
        : null
    }));

    render(<DesktopUpdateConfig />);

    expect(screen.getByText('正在下载 50%')).toBeTruthy();
    expect(screen.getByText('50 B / 100 B')).toBeTruthy();
  });
});
