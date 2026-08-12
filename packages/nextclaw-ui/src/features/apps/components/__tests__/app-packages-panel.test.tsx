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
  operations: [] as Array<{
    id: string;
    action: 'install';
    appId: string;
    source: string;
    status: 'downloading';
    completedSteps: number;
    totalSteps: number;
    createdAt: string;
    updatedAt: string;
  }>,
  recordOpened: vi.fn(),
  refetchOperations: vi.fn(),
  refetchPackages: vi.fn(),
  refetchPanels: vi.fn(),
  requestAuthorization: vi.fn(async () => true),
}));

vi.mock('@/app/components/app-presenter-provider', () => ({
  useAppPresenter: () => ({
    appPackageOperationSettlementManager: { settle: vi.fn() },
    serviceActionAuthorizationManager: {
      requestAuthorization: mocks.requestAuthorization,
    },
  }),
}));

vi.mock('@/features/apps/hooks/use-app-packages', () => ({
  isAppPackageOperationActive: (status: string) => [
    'queued',
    'resolving',
    'downloading',
    'verifying',
    'installing',
    'finalizing',
  ].includes(status),
  useAppPackageMutation: () => ({
    error: null,
    isError: false,
    isPending: false,
    mutate: mocks.lifecycleMutate,
    reset: mocks.lifecycleReset,
    variables: undefined,
  }),
  useAppPackageOperationSettlement: () => undefined,
  useAppPackageOperations: () => ({
    data: { entries: mocks.operations },
    refetch: mocks.refetchOperations,
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
          id: 'app-workspace-glance',
          slug: 'workspace-glance',
          appId: 'nextclaw.workspace-glance',
          name: 'Workspace Glance',
          summary: 'A local workspace overview.',
          summaryI18n: { en: 'A local workspace overview.' },
          tags: ['workspace', 'local'],
          latestVersion: '0.1.0',
          featured: false,
          publisher: { id: 'nextclaw', name: 'NextClaw' },
          install: {
            kind: 'registry',
            spec: 'nextclaw.workspace-glance',
            registry: 'https://apps-registry.nextclaw.io/api/v1/apps/registry/',
          },
          webUrl: 'https://apps.nextclaw.io/apps/workspace-glance',
        },
      ],
    },
    error: null,
    isError: false,
    isLoading: false,
  }),
  useAppMarketplaceDetail: () => ({
    data: undefined,
    error: null,
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
    mocks.operations = [];
    mocks.recordOpened.mockReset();
    mocks.refetchPackages.mockReset();
    mocks.refetchOperations.mockReset();
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

    await user.click(screen.getByRole('button', { name: 'Add apps' }));

    expect(screen.getByRole('heading', { name: 'Add apps' })).toBeTruthy();
    expect(screen.getByText('Workspace Glance')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Installed' }) as HTMLButtonElement).disabled,
    ).toBe(true);

    const installButtons = screen.getAllByRole('button', { name: 'Install app' });
    await user.click(installButtons.at(-1)!);

    expect(mocks.lifecycleMutate).toHaveBeenCalledWith(
      {
        action: 'install',
        source: 'nextclaw.workspace-glance',
        registryUrl: 'https://apps-registry.nextclaw.io/api/v1/apps/registry/',
      },
      { onSuccess: undefined },
    );
  });

  it('allows a built-in app to be uninstalled while keeping its data by default', async () => {
    const user = userEvent.setup();

    render(<AppPackagesPanel onOpenPanelApp={mocks.onOpen} />);

    await user.click(screen.getByRole('button', { name: 'More app actions' }));
    await user.click(screen.getByRole('button', { name: 'Uninstall' }));
    expect(screen.getByRole('heading', { name: 'Uninstall this app?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Keep personal data/ }).getAttribute('aria-pressed'))
      .toBe('true');

    await user.click(screen.getByRole('button', { name: 'Uninstall' }));
    expect(mocks.lifecycleMutate).toHaveBeenCalledWith(
      { action: 'uninstall', appId: 'nextclaw.personal-organizer', purgeData: false },
      { onSuccess: undefined },
    );
  });

  it('keeps an accepted install visible in the library and marketplace while it runs', async () => {
    const user = userEvent.setup();
    mocks.operations = [{
      id: 'operation-1',
      action: 'install',
      appId: 'nextclaw.workspace-glance',
      source: 'nextclaw.workspace-glance',
      status: 'downloading',
      completedSteps: 2,
      totalSteps: 5,
      createdAt: '2026-08-12T00:00:00.000Z',
      updatedAt: '2026-08-12T00:00:01.000Z',
    }];

    render(<AppPackagesPanel onOpenPanelApp={mocks.onOpen} />);

    expect(screen.getByRole('status').textContent).toContain('Downloading');
    expect(screen.getByText('nextclaw.workspace-glance')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Add apps' }));

    expect(screen.getByRole('heading', { name: 'Add apps' })).toBeTruthy();
    expect(screen.getAllByText('Downloading')).not.toHaveLength(0);
    expect((screen.getByRole('button', { name: 'Downloading' }) as HTMLButtonElement).disabled)
      .toBe(true);
  });
});
