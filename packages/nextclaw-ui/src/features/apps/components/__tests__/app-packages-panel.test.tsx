import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppPackagesPanel } from '@/features/apps/components/app-packages-panel';

const mocks = vi.hoisted(() => ({
  enabled: false,
  grantClient: vi.fn(),
  lifecycleMutate: vi.fn(),
  lifecycleReset: vi.fn(),
  onOpen: vi.fn(),
  recordOpened: vi.fn(),
  refetchPackages: vi.fn(),
  refetchPanels: vi.fn(),
  requestAuthorization: vi.fn(async () => true),
}));

vi.mock('@/app/components/app-presenter-provider', () => ({
  useAppPresenter: () => ({
    serviceActionAuthorizationManager: {
      requestAuthorization: mocks.requestAuthorization,
    },
  }),
}));

vi.mock('@/features/apps/hooks/use-app-packages', () => ({
  useAppPackageMutation: () => ({
    error: null,
    isError: false,
    isPending: false,
    mutate: mocks.lifecycleMutate,
    reset: mocks.lifecycleReset,
    variables: undefined,
  }),
  useAppPackages: () => ({
    data: {
      entries: [{
        activeVersion: '0.1.0',
        builtIn: true,
        components: [
          {
            dataDirectory: '/tmp/data',
            description: 'Clear personal todos.',
            id: 'nextclaw-personal-organizer-todos',
            icon: '✓',
            kind: 'panel',
            manifestPath: '/tmp/app/panel-app.json',
            packageId: 'nextclaw.personal-organizer',
            packageVersion: '0.1.0',
            sourcePath: '/tmp/app/todos.panel',
            title: 'Todos',
          },
          {
            dataDirectory: '/tmp/data',
            id: 'nextclaw-personal-organizer-data',
            kind: 'service',
            manifestPath: '/tmp/app/service-app.json',
            packageId: 'nextclaw.personal-organizer',
            packageVersion: '0.1.0',
            sourcePath: '/tmp/app/data',
            title: 'Personal data',
          },
        ],
        dataDirectory: '/tmp/data',
        description: 'Todos, notes, favorites, and calendar.',
        enabled: mocks.enabled,
        id: 'nextclaw.personal-organizer',
        installedVersions: ['0.1.0'],
        name: 'Personal Space',
        primaryPanelId: 'nextclaw-personal-organizer-todos',
      }],
    },
    error: null,
    isError: false,
    isLoading: false,
    refetch: mocks.refetchPackages,
  }),
}));

vi.mock('@/features/apps/hooks/use-app-marketplace', () => ({
  useAppMarketplace: () => ({
    data: {
      total: 2,
      items: [
        {
          id: 'app-personal-organizer',
          slug: 'personal-organizer',
          appId: 'nextclaw.personal-organizer',
          name: '个人空间',
          summary: 'A calm personal space.',
          summaryI18n: { en: 'A calm personal space.' },
          tags: ['personal'],
          latestVersion: '0.1.0',
          featured: true,
          publisher: { id: 'nextclaw', name: 'NextClaw' },
          install: {
            kind: 'registry',
            spec: 'nextclaw.personal-organizer',
            registry: 'https://apps-registry.nextclaw.io/api/v1/apps/registry/',
          },
          webUrl: 'https://apps.nextclaw.io/apps/personal-organizer',
        },
        {
          id: 'app-starter-card',
          slug: 'starter-card',
          appId: 'nextclaw.starter-card',
          name: 'Starter Card',
          summary: 'A tiny starter app.',
          summaryI18n: { en: 'A tiny starter app.' },
          tags: ['starter'],
          latestVersion: '0.1.0',
          featured: false,
          publisher: { id: 'nextclaw', name: 'NextClaw' },
          install: {
            kind: 'registry',
            spec: 'nextclaw.starter-card',
            registry: 'https://apps-registry.nextclaw.io/api/v1/apps/registry/',
          },
          webUrl: 'https://apps.nextclaw.io/apps/starter-card',
        },
      ],
    },
    error: null,
    isError: false,
    isLoading: false,
  }),
}));

vi.mock('@/features/panel-apps/hooks/use-panel-apps', () => ({
  useGrantPanelAppClient: () => ({ mutateAsync: mocks.grantClient }),
  usePanelApps: () => ({
    data: {
      entries: mocks.enabled ? [{
        appId: 'nextclaw-personal-organizer-todos',
        clientDeclared: false,
        clientGranted: false,
        contentPath: '/api/panel-apps/todos/content',
        createdAt: '2026-08-12T00:00:00.000Z',
        favorite: false,
        fileName: 'nextclaw-personal-organizer-todos.panel',
        id: 'todos',
        kind: 'folder',
        openCount: 0,
        packageId: 'nextclaw.personal-organizer',
        packageVersion: '0.1.0',
        sizeBytes: 1,
        sourceKind: 'package',
        title: 'Todos',
        updatedAt: '2026-08-12T00:00:00.000Z',
      }] : [],
    },
    error: null,
    isError: false,
    isLoading: false,
    refetch: mocks.refetchPanels,
  }),
  useRecordPanelAppOpened: () => ({ mutateAsync: mocks.recordOpened }),
}));

describe('AppPackagesPanel', () => {
  beforeEach(() => {
    mocks.enabled = false;
    mocks.grantClient.mockReset();
    mocks.lifecycleMutate.mockReset();
    mocks.lifecycleReset.mockReset();
    mocks.onOpen.mockReset();
    mocks.recordOpened.mockReset();
    mocks.refetchPackages.mockReset();
    mocks.refetchPanels.mockReset();
    mocks.requestAuthorization.mockReset();
    mocks.requestAuthorization.mockResolvedValue(true);
  });

  it('shows a built-in package and enables it from the primary action', async () => {
    const user = userEvent.setup();

    render(<AppPackagesPanel onOpenPanelApp={mocks.onOpen} />);

    expect(screen.getByText('Personal Space')).toBeTruthy();
    expect(screen.getByText('Available')).toBeTruthy();
    expect(screen.getByText('Local data service')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Enable' }));

    expect(mocks.lifecycleMutate).toHaveBeenCalledWith(
      { action: 'enable', appId: 'nextclaw.personal-organizer' },
      { onSuccess: undefined },
    );
  });

  it('opens an enabled package panel through the existing panel app chain', async () => {
    const user = userEvent.setup();
    mocks.enabled = true;
    const openedEntry = {
      appId: 'nextclaw-personal-organizer-todos',
      id: 'todos',
      title: 'Todos',
    };
    mocks.recordOpened.mockResolvedValue(openedEntry);

    render(<AppPackagesPanel onOpenPanelApp={mocks.onOpen} />);

    await user.click(screen.getByRole('button', { name: /Todos/ }));

    expect(mocks.recordOpened).toHaveBeenCalledWith('todos');
    expect(mocks.onOpen).toHaveBeenCalledWith(openedEntry);
  });

  it('discovers marketplace apps and installs one through its registry spec', async () => {
    const user = userEvent.setup();

    render(<AppPackagesPanel onOpenPanelApp={mocks.onOpen} />);

    await user.click(screen.getByRole('button', { name: 'Browse apps' }));

    expect(screen.getByRole('heading', { name: 'Browse Mini APPs' })).toBeTruthy();
    expect(screen.getByText('Starter Card')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Installed' }) as HTMLButtonElement).disabled,
    ).toBe(true);

    const installButtons = screen.getAllByRole('button', { name: 'Install app' });
    await user.click(installButtons.at(-1)!);

    expect(mocks.lifecycleMutate).toHaveBeenCalledWith(
      {
        action: 'install',
        source: 'nextclaw.starter-card',
        registryUrl: 'https://apps-registry.nextclaw.io/api/v1/apps/registry/',
      },
      { onSuccess: expect.any(Function) },
    );
  });
});
