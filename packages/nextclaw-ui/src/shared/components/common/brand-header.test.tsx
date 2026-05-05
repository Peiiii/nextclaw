import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandHeader } from '@/shared/components/common/brand-header';
import { setLanguage } from '@/shared/lib/i18n';
import { useDesktopUpdateStore } from '@/platforms/desktop';

const mocks = vi.hoisted(() => ({
  applyDownloadedUpdate: vi.fn(),
  downloadUpdate: vi.fn()
}));

vi.mock('@/platforms/desktop', async () => {
  const actual = await vi.importActual<typeof import('@/platforms/desktop')>(
    '@/platforms/desktop'
  );
  return {
    ...actual,
    desktopUpdateManager: {
      ...actual.desktopUpdateManager,
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
    useDesktopUpdateStore.setState({
      supported: false,
      initialized: false,
      busyAction: null,
      snapshot: null
    });
    mocks.applyDownloadedUpdate.mockReset();
    mocks.downloadUpdate.mockReset();
  });

  it('shows update progress next to the product version', () => {
    useDesktopUpdateStore.setState({
      supported: true,
      initialized: true,
      busyAction: null,
      snapshot: {
        status: 'downloading',
        installationKind: 'desktop-bundle',
        channel: 'stable',
        hostVersion: '0.0.138',
        launcherVersion: '0.0.138',
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

    expect(screen.getByText('v0.18.11')).toBeTruthy();
    expect(screen.getByText('下载 50%')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '更新' })).toBeNull();
  });

  it('applies the downloaded update from the version-adjacent update button', async () => {
    const user = userEvent.setup();
    useDesktopUpdateStore.setState({
      supported: true,
      initialized: true,
      busyAction: null,
      snapshot: {
        status: 'downloaded',
        installationKind: 'desktop-bundle',
        channel: 'stable',
        hostVersion: '0.0.138',
        launcherVersion: '0.0.138',
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
});
