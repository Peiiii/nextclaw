import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRuntimeUpdateStore } from '@/features/system-status';
import { DesktopUpdateConfig } from '@/features/system-status/components/desktop-update-config';
import { setLanguage } from '@/shared/lib/i18n';
import type * as SystemStatusModule from '@/features/system-status';

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  applyDownloadedUpdate: vi.fn(),
  updateChannel: vi.fn()
}));

vi.mock('@/features/system-status', async () => {
  const actual = await vi.importActual<typeof SystemStatusModule>(
    '@/features/system-status'
  );
  return {
    ...actual,
    runtimeUpdateManager: mocks,
  };
});

function renderDesktopUpdateConfig() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        retry: false
      }
    }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DesktopUpdateConfig />
    </QueryClientProvider>
  );
}

describe('DesktopUpdateConfig', () => {
  beforeEach(() => {
    setLanguage('zh');
    mocks.start.mockReset();
    mocks.stop.mockReset();
    mocks.checkForUpdates.mockReset();
    mocks.downloadUpdate.mockReset();
    mocks.applyDownloadedUpdate.mockReset();
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
        releaseNotesUrl: null,
        lastCheckedAt: '2026-04-13T12:00:00.000Z',
        progress: null,
        canApplyInApp: false,
        requiresRestart: false,
        blockReason: null,
        recoveryCommand: null,
        errorMessage: null
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders current channel information and beta guidance', () => {
    renderDesktopUpdateConfig();

    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.stop).not.toHaveBeenCalled();
    expect(screen.getByText('版本更新')).toBeTruthy();
    expect(screen.getByText('宿主版本')).toBeTruthy();
    expect(screen.getByText('当前更新通道')).toBeTruthy();
    expect(screen.getAllByText('Beta').length).toBeGreaterThan(0);
    expect(screen.getByText('当前正在跟随 Beta 通道')).toBeTruthy();
    expect(screen.getByText('系统每两小时自动检查更新，下载和应用都由你手动确认。')).toBeTruthy();
    expect(screen.queryByText('自动检查更新')).toBeNull();
    expect(screen.queryByText('发现更新后自动后台下载')).toBeNull();
    expect(screen.getByText('切回 Stable 后不会立刻强制降级；只有当 Stable 追平或超过当前版本时，才会继续提供 Stable 更新。')).toBeTruthy();
  });

  it('sends the newly selected release channel to the desktop update manager', async () => {
    const user = userEvent.setup();

    renderDesktopUpdateConfig();

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

    renderDesktopUpdateConfig();

    expect(screen.getByText('正在下载 50%')).toBeTruthy();
    expect(screen.getByText('50 B / 100 B')).toBeTruthy();
  });

  it('labels a failed check separately from an update failure', () => {
    useRuntimeUpdateStore.setState((state) => ({
      ...state,
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            status: 'failed',
            currentVersion: '0.24.0',
            failureStage: 'check',
            errorMessage: 'fetch failed: getaddrinfo ENOTFOUND updates.nextclaw.io'
          }
        : null
    }));

    renderDesktopUpdateConfig();

    expect(screen.getByText('检查更新失败')).toBeTruthy();
    expect(screen.getByText('0.24.0')).toBeTruthy();
    expect(screen.getByText('fetch failed: getaddrinfo ENOTFOUND updates.nextclaw.io')).toBeTruthy();
  });

  it('loads structured release notes from the docs JSON endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      schemaVersion: 1,
      product: 'NextClaw',
      version: '0.22.0',
      sections: [
        {
          kind: 'feature',
          title: {
            'zh-CN': '功能',
            'en-US': 'Features'
          },
          items: [
            {
              title: {
                'zh-CN': '更新前查看内容',
                'en-US': 'Review before updating'
              },
              body: {
                'zh-CN': '更新提示可以直接展示本版本的结构化说明。',
                'en-US': 'The update prompt can show structured notes for this version.'
              }
            }
          ]
        },
        {
          kind: 'fix',
          title: {
            'zh-CN': '修复',
            'en-US': 'Fixes'
          },
          items: [
            {
              title: {
                'zh-CN': '附件发送修复',
                'en-US': 'Attachment delivery fix'
              }
            }
          ]
        }
      ]
    }), {
      headers: { 'content-type': 'application/json' },
      status: 200
    }));
    vi.stubGlobal('fetch', fetchMock);
    useRuntimeUpdateStore.setState((state) => ({
      ...state,
      snapshot: state.snapshot
        ? {
            ...state.snapshot,
            status: 'update-available',
            availableVersion: '0.22.0',
            releaseNotesUrl: 'https://docs.nextclaw.io/zh/notes/2026-07-05-nextclaw-v0-22-0'
          }
        : null
    }));

    renderDesktopUpdateConfig();

    expect(await screen.findByText('更新前查看内容')).toBeTruthy();
    expect(screen.getByText('修复')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://docs.nextclaw.io/release-notes/nextclaw-v0.22.0.json',
      expect.objectContaining({
        cache: 'no-store',
        headers: { accept: 'application/json' }
      })
    );
  });
});
