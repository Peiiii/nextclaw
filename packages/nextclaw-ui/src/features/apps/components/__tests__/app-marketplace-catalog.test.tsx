import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppMarketplaceCatalog } from '@/features/apps/components/app-marketplace-catalog';
import type { AppMarketplaceItemView } from '@/features/apps/types/app-marketplace.types';
import { Dialog } from '@/shared/components/ui/dialog';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { setLanguage } from '@/shared/lib/i18n';

const LINUX_ONLY_APP: AppMarketplaceItemView = {
  id: 'rust-todo',
  slug: 'rust-todo',
  appId: 'peiiii.rust-todo',
  name: 'Rust Todo',
  summary: '轻量待办应用',
  summaryI18n: {},
  tags: ['todo'],
  latestVersion: '0.1.0',
  featured: false,
  availability: {
    mode: 'targeted',
    targets: ['linux-x64-gnu'],
    operatingSystems: ['linux'],
  },
  publisher: { id: 'peiiii', name: 'peiiii' },
  install: {
    kind: 'registry',
    spec: 'peiiii.rust-todo',
    registry: 'https://apps-registry.nextclaw.io',
  },
  webUrl: 'https://nextclaw.io/apps/rust-todo',
};

describe('AppMarketplaceCatalog compatibility actions', () => {
  it('keeps an incompatible app discoverable but disables installation and hides stale failures', () => {
    setLanguage('zh');
    const onInstall = vi.fn();
    const onSelect = vi.fn();

    render(
      <TooltipProvider>
        <Dialog>
          <AppMarketplaceCatalog
          error={null}
          filter="all"
          hostTarget={{
            key: 'darwin-arm64',
            operatingSystem: 'darwin',
            architecture: 'arm64',
          }}
          installedById={new Map()}
          isError={false}
          isFetchingNextPage={false}
          isLoading={false}
          isStarting={false}
          items={[LINUX_ONLY_APP]}
          localeFallbacks={['zh-CN']}
          onFilterChange={vi.fn()}
          onInstall={onInstall}
          onLoadMore={vi.fn()}
          onSearchChange={vi.fn()}
          onSelect={onSelect}
          onUpdate={vi.fn()}
          operations={[{
            id: 'failed-install',
            action: 'install',
            appId: 'peiiii.rust-todo',
            source: 'peiiii.rust-todo',
            status: 'failed',
            completedSteps: 0,
            totalSteps: 1,
            createdAt: '2026-08-20T00:00:00.000Z',
            updatedAt: '2026-08-20T00:00:00.000Z',
            error: 'raw registry failure',
          }]}
          hasNextPage={false}
          search=""
          />
        </Dialog>
      </TooltipProvider>,
    );

    expect(screen.getByText('仅支持 Linux')).toBeTruthy();
    expect(screen.getByText('这台设备无法安装')).toBeTruthy();
    const installButton = screen.getByRole('button', { name: '无法安装' });
    expect((installButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText('raw registry failure')).toBeNull();

    fireEvent.click(installButton);
    expect(onInstall).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: /Rust Todo/ })[0]);
    expect(onSelect).toHaveBeenCalledWith('rust-todo');
  });

  it('does not project a persisted terminal failure back into a compatible card', () => {
    setLanguage('zh');
    const onInstall = vi.fn();

    render(
      <TooltipProvider>
        <Dialog>
          <AppMarketplaceCatalog
            error={null}
            filter="all"
            hostTarget={{
              key: 'darwin-arm64',
              operatingSystem: 'darwin',
              architecture: 'arm64',
            }}
            installedById={new Map()}
            isError={false}
            isFetchingNextPage={false}
            isLoading={false}
            isStarting={false}
            items={[{
              ...LINUX_ONLY_APP,
              availability: {
                mode: 'universal',
                targets: [],
                operatingSystems: [],
              },
            }]}
            localeFallbacks={['zh-CN']}
            onFilterChange={vi.fn()}
            onInstall={onInstall}
            onLoadMore={vi.fn()}
            onSearchChange={vi.fn()}
            onSelect={vi.fn()}
            onUpdate={vi.fn()}
            operations={[{
              id: 'persisted-failure',
              action: 'install',
              appId: 'peiiii.rust-todo',
              source: 'peiiii.rust-todo',
              status: 'failed',
              completedSteps: 0,
              totalSteps: 1,
              createdAt: '2026-08-19T00:00:00.000Z',
              updatedAt: '2026-08-19T00:00:01.000Z',
              completedAt: '2026-08-19T00:00:01.000Z',
              error: 'persisted registry failure',
            }]}
            hasNextPage={false}
            search=""
          />
        </Dialog>
      </TooltipProvider>,
    );

    expect(screen.queryByText('persisted registry failure')).toBeNull();
    expect(screen.queryByRole('button', { name: '重试' })).toBeNull();
    const installButton = screen.getByRole('button', { name: '安装应用' });
    expect((installButton as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(installButton);
    expect(onInstall).toHaveBeenCalledWith(
      'peiiii.rust-todo',
      'https://apps-registry.nextclaw.io',
    );
  });
});
