import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SystemStatusModule from '@/features/system-status';
import { useRuntimeUpdateStore } from '@/features/system-status';
import { BrandHeader } from '@/shared/components/common/brand-header';
import { setLanguage } from '@/shared/lib/i18n';

const mocks = vi.hoisted(() => ({
  applyDownloadedUpdate: vi.fn(),
  downloadUpdate: vi.fn(),
  fetchReleaseNotes: vi.fn(),
  openExternalUrl: vi.fn()
}));

vi.mock('@/features/system-status', async () => {
  const actual = await vi.importActual<typeof SystemStatusModule>('@/features/system-status');
  return {
    ...actual,
    runtimeUpdateManager: {
      ...actual.runtimeUpdateManager,
      applyDownloadedUpdate: mocks.applyDownloadedUpdate,
      downloadUpdate: mocks.downloadUpdate
    }
  };
});

vi.mock('@/shared/lib/host-capabilities', () => ({
  hostCapabilityManager: {
    openExternalUrl: mocks.openExternalUrl,
  },
}));

function createReleaseNotesResponse(urls?: { zh?: string; en?: string }): Response {
  return new Response(JSON.stringify({
    links: urls
      ? {
          html: {
            ...(urls.zh ? { 'zh-CN': urls.zh } : {}),
            ...(urls.en ? { 'en-US': urls.en } : {})
          }
        }
      : undefined,
    sections: []
  }), {
    headers: { 'content-type': 'application/json' },
    status: 200
  });
}

function renderBrandHeader(options: { productVersion?: string } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
  queryClient.setQueryData(['app-meta'], {
    name: 'NextClaw',
    productVersion: options.productVersion ?? '0.18.11'
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BrandHeader suffix={null} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('BrandHeader', () => {
  beforeEach(() => {
    setLanguage('zh');
    useRuntimeUpdateStore.setState({
      supported: false,
      initialized: false,
      busyAction: null,
      snapshot: null
    });
    mocks.applyDownloadedUpdate.mockReset();
    mocks.downloadUpdate.mockReset();
    mocks.fetchReleaseNotes.mockReset();
    mocks.fetchReleaseNotes.mockResolvedValue(createReleaseNotesResponse());
    mocks.openExternalUrl.mockReset();
    vi.stubGlobal('fetch', mocks.fetchReleaseNotes);
  });

  it('shows update progress next to the product version', async () => {
    const user = userEvent.setup();
    useRuntimeUpdateStore.setState({
      supported: true,
      initialized: true,
      busyAction: null,
      snapshot: {
        status: 'downloading',
        installationKind: 'desktop-bundle',
        channel: 'stable',
        hostVersion: '0.0.138',
        currentVersion: '0.18.11',
        availableVersion: '0.18.12',
        downloadedVersion: null,
        minimumHostVersion: null,
        releaseNotesUrl: 'https://docs.nextclaw.io/zh/notes/2026-07-15-nextclaw-v0-18-12',
        lastCheckedAt: null,
        progress: {
          downloadedBytes: 50,
          totalBytes: 100,
          percent: 50
        },
        canApplyInApp: false,
        requiresRestart: false,
        blockReason: null,
        recoveryCommand: null,
        errorMessage: null
      }
    });

    renderBrandHeader();

    const version = screen.getByText('v0.18.11');
    expect(version).toBeTruthy();
    expect(screen.getAllByText('v0.18.11')).toHaveLength(1);
    await user.hover(version);
    expect((await screen.findByRole('tooltip')).textContent).toBe('v0.18.11');
    const downloadProgress = screen.getByText('下载 50%');
    expect(downloadProgress).toBeTruthy();
    expect(screen.queryByRole('button', { name: '更新' })).toBeNull();
    const progressReleaseNotes = screen.getByRole('link', { name: '查看 v0.18.12 更新说明' });
    expect(progressReleaseNotes.parentElement?.className).toContain('invisible');
    expect(progressReleaseNotes.parentElement?.className).toContain('group-hover/update-release-notes:visible');

    await user.hover(downloadProgress);
    await user.click(progressReleaseNotes);

    expect(mocks.openExternalUrl).toHaveBeenCalledWith('https://docs.nextclaw.io/zh/notes/2026-07-15-nextclaw-v0-18-12');
  });

  it('opens release notes from the current version tooltip when that version has docs notes', async () => {
    const user = userEvent.setup();
    mocks.fetchReleaseNotes.mockResolvedValueOnce(createReleaseNotesResponse({
      zh: 'https://docs.nextclaw.io/zh/notes/2026-07-15-nextclaw-v0-23-0',
      en: 'https://docs.nextclaw.io/en/notes/2026-07-15-nextclaw-v0-23-0'
    }));

    renderBrandHeader({ productVersion: '0.23.0' });

    const version = await screen.findByRole('link', {
      name: '当前版本 v0.23.0，查看 v0.23.0 更新说明'
    });

    await user.hover(version);
    expect((await screen.findByRole('tooltip')).textContent).toContain('点击查看 v0.23.0 更新说明');

    await user.click(version);

    expect(mocks.fetchReleaseNotes).toHaveBeenCalledWith(
      'https://docs.nextclaw.io/release-notes/nextclaw-v0.23.0.json',
      expect.objectContaining({ cache: 'no-store' })
    );
    expect(mocks.openExternalUrl).toHaveBeenCalledWith('https://docs.nextclaw.io/zh/notes/2026-07-15-nextclaw-v0-23-0');
  });

  it('keeps update target release notes available without replacing the current version link', async () => {
    const user = userEvent.setup();
    mocks.fetchReleaseNotes.mockResolvedValueOnce(createReleaseNotesResponse({
      zh: 'https://docs.nextclaw.io/zh/notes/2026-07-14-nextclaw-v0-18-11'
    }));
    useRuntimeUpdateStore.setState({
      supported: true,
      initialized: true,
      busyAction: null,
      snapshot: {
        status: 'update-available',
        installationKind: 'npm-runtime-bundle',
        channel: 'stable',
        hostVersion: '0.18.11',
        currentVersion: '0.18.11',
        availableVersion: '0.18.12',
        downloadedVersion: null,
        minimumHostVersion: null,
        releaseNotesUrl: 'https://docs.nextclaw.io/zh/notes/2026-07-15-nextclaw-v0-18-12',
        lastCheckedAt: null,
        progress: null,
        canApplyInApp: false,
        requiresRestart: false,
        blockReason: null,
        recoveryCommand: null,
        errorMessage: null
      }
    });

    renderBrandHeader();

    const currentVersion = await screen.findByRole('link', {
      name: '当前版本 v0.18.11，查看 v0.18.11 更新说明'
    });
    await user.click(currentVersion);
    expect(mocks.openExternalUrl).toHaveBeenCalledWith('https://docs.nextclaw.io/zh/notes/2026-07-14-nextclaw-v0-18-11');

    const downloadUpdate = screen.getByRole('button', { name: '下载' });
    const updateReleaseNotes = screen.getByRole('link', { name: '查看 v0.18.12 更新说明' });
    expect(updateReleaseNotes.parentElement?.className).toContain('group-hover/update-release-notes:visible');

    await user.hover(downloadUpdate);
    await user.click(updateReleaseNotes);
    expect(mocks.openExternalUrl).toHaveBeenLastCalledWith('https://docs.nextclaw.io/zh/notes/2026-07-15-nextclaw-v0-18-12');

    await user.click(downloadUpdate);
    expect(mocks.downloadUpdate).toHaveBeenCalledTimes(1);
  });

  it('applies the downloaded update from the version-adjacent update button', async () => {
    const user = userEvent.setup();
    useRuntimeUpdateStore.setState({
      supported: true,
      initialized: true,
      busyAction: null,
      snapshot: {
        status: 'downloaded',
        installationKind: 'desktop-bundle',
        channel: 'stable',
        hostVersion: '0.0.138',
        currentVersion: '0.18.11',
        availableVersion: null,
        downloadedVersion: '0.18.12',
        minimumHostVersion: null,
        releaseNotesUrl: 'https://docs.nextclaw.io/zh/notes/2026-07-15-nextclaw-v0-18-12',
        lastCheckedAt: null,
        progress: null,
        canApplyInApp: true,
        requiresRestart: false,
        blockReason: null,
        recoveryCommand: null,
        errorMessage: null
      }
    });

    renderBrandHeader();

    const applyUpdate = screen.getByRole('button', { name: '更新' });
    const updateReleaseNotes = screen.getByRole('link', { name: '查看 v0.18.12 更新说明' });
    expect(updateReleaseNotes.parentElement?.className).toContain('group-focus-within/update-release-notes:visible');

    fireEvent.focus(applyUpdate);
    await user.click(updateReleaseNotes);
    expect(mocks.openExternalUrl).toHaveBeenCalledWith('https://docs.nextclaw.io/zh/notes/2026-07-15-nextclaw-v0-18-12');

    await user.click(applyUpdate);

    expect(mocks.applyDownloadedUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.downloadUpdate).not.toHaveBeenCalled();
  });

  it('shows a warning icon with the blocked update reason instead of a visible failure label', async () => {
    const user = userEvent.setup();
    useRuntimeUpdateStore.setState({
      supported: true,
      initialized: true,
      busyAction: null,
      snapshot: {
        status: 'blocked',
        installationKind: 'npm-runtime-bundle',
        channel: 'stable',
        hostVersion: '0.19.4',
        currentVersion: '0.19.4',
        availableVersion: null,
        downloadedVersion: null,
        minimumHostVersion: null,
        releaseNotesUrl: null,
        lastCheckedAt: null,
        progress: null,
        canApplyInApp: false,
        requiresRestart: false,
        blockReason: 'signature-verification-unavailable',
        recoveryCommand: 'Set NEXTCLAW_UPDATE_BUNDLE_PUBLIC_KEY',
        errorMessage: 'Runtime bundle updates require a configured update public key.'
      }
    });

    renderBrandHeader();

    expect(screen.queryByText('更新异常')).toBeNull();
    const issueIcon = screen.getByLabelText('更新被阻塞');

    expect(issueIcon.textContent).toBe('!');
    expect(issueIcon.hasAttribute('title')).toBe(false);

    await user.hover(issueIcon);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('更新被阻塞');
    expect(tooltip.textContent).toContain('根因：缺少更新签名公钥，无法验证更新包来源');
    expect(tooltip.textContent).toContain('Runtime bundle updates require a configured update public key.');
    expect(tooltip.textContent).toContain('Set NEXTCLAW_UPDATE_BUNDLE_PUBLIC_KEY');
  });

  it('distinguishes a failed post-restart check from a failed update', async () => {
    const user = userEvent.setup();
    useRuntimeUpdateStore.setState({
      supported: true,
      initialized: true,
      busyAction: null,
      snapshot: {
        status: 'failed',
        installationKind: 'npm-runtime-bundle',
        channel: 'stable',
        hostVersion: '0.19.4',
        currentVersion: '0.19.3',
        availableVersion: '0.19.4',
        downloadedVersion: null,
        minimumHostVersion: null,
        releaseNotesUrl: null,
        lastCheckedAt: null,
        progress: null,
        canApplyInApp: false,
        requiresRestart: false,
        blockReason: null,
        recoveryCommand: null,
        errorMessage: 'fetch failed: getaddrinfo ENOTFOUND updates.nextclaw.io',
        failureStage: 'check',
        diagnosticCommand: 'nextclaw logs path'
      }
    });

    renderBrandHeader({ productVersion: '0.24.0' });

    expect(screen.getByText('v0.24.0')).not.toBeNull();
    const issueIcon = screen.getByLabelText('检查更新失败');

    expect(issueIcon.textContent).toBe('!');
    await user.hover(issueIcon);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('检查更新失败');
    expect(tooltip.textContent).toContain('fetch failed: getaddrinfo ENOTFOUND updates.nextclaw.io');
    expect(tooltip.textContent).toContain('完整日志：nextclaw logs path');
    expect(screen.queryByText('更新被阻塞')).toBeNull();
  });
});
