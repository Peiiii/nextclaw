import { render, screen } from '@testing-library/react';
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
  downloadUpdate: vi.fn()
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

function renderBrandHeader() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
  queryClient.setQueryData(['app-meta'], {
    name: 'NextClaw',
    productVersion: '0.18.11'
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
        releaseNotesUrl: null,
        lastCheckedAt: null,
        progress: {
          downloadedBytes: 50,
          totalBytes: 100,
          percent: 50
        },
        canAutoDownload: true,
        canApplyInApp: false,
        requiresRestart: false,
        blockReason: null,
        recoveryCommand: null,
        errorMessage: null,
        preferences: {
          automaticChecks: true,
          autoDownload: true
        }
      }
    });

    renderBrandHeader();

    const version = screen.getByText('v0.18.11');
    expect(version).toBeTruthy();
    expect(screen.getAllByText('v0.18.11')).toHaveLength(1);
    await user.hover(version);
    expect(await screen.findAllByText('v0.18.11')).toHaveLength(2);
    expect(screen.getByText('下载 50%')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '更新' })).toBeNull();
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
        releaseNotesUrl: null,
        lastCheckedAt: null,
        progress: null,
        canAutoDownload: true,
        canApplyInApp: true,
        requiresRestart: false,
        blockReason: null,
        recoveryCommand: null,
        errorMessage: null,
        preferences: {
          automaticChecks: true,
          autoDownload: true
        }
      }
    });

    renderBrandHeader();

    await user.click(screen.getByRole('button', { name: '更新' }));

    expect(mocks.applyDownloadedUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.downloadUpdate).not.toHaveBeenCalled();
  });

  it('shows a warning icon with the blocked update reason instead of a visible failure label', async () => {
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
        canAutoDownload: true,
        canApplyInApp: false,
        requiresRestart: false,
        blockReason: 'signature-verification-unavailable',
        recoveryCommand: 'Set NEXTCLAW_UPDATE_BUNDLE_PUBLIC_KEY',
        errorMessage: 'Runtime bundle updates require a configured update public key.',
        preferences: {
          automaticChecks: true,
          autoDownload: true
        }
      }
    });

    renderBrandHeader();

    expect(screen.queryByText('更新异常')).toBeNull();
    const issueIcon = screen.getByLabelText('更新被阻塞');

    expect(issueIcon.textContent).toBe('!');
    expect(issueIcon.getAttribute('title')).toContain('更新被阻塞');
    expect(issueIcon.getAttribute('title')).toContain('根因：缺少更新签名公钥，无法验证更新包来源');
    expect(issueIcon.getAttribute('title')).toContain('Runtime bundle updates require a configured update public key.');
    expect(issueIcon.getAttribute('title')).toContain('Set NEXTCLAW_UPDATE_BUNDLE_PUBLIC_KEY');
  });

  it('uses the failed update wording only for failed snapshots', async () => {
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
        canAutoDownload: true,
        canApplyInApp: false,
        requiresRestart: false,
        blockReason: null,
        recoveryCommand: null,
        errorMessage: 'runtime bundle sha256 mismatch',
        preferences: {
          automaticChecks: true,
          autoDownload: true
        }
      }
    });

    renderBrandHeader();

    const issueIcon = screen.getByLabelText('更新失败');

    expect(issueIcon.textContent).toBe('!');
    expect(issueIcon.getAttribute('title')).toContain('更新失败');
    expect(issueIcon.getAttribute('title')).toContain('runtime bundle sha256 mismatch');
    expect(screen.queryByText('更新被阻塞')).toBeNull();
  });
});
