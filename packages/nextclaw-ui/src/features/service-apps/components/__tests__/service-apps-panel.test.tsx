import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ServiceAppsPanel } from '@/features/service-apps/components/service-apps-panel';

const deleteServiceAppMutate = vi.fn();
const discoverServiceAppActionsMutateAsync = vi.fn(async () => ({ actions: [] }));
const refetchServiceActions = vi.fn();
const refetchServiceActionGrants = vi.fn();
const refetchServiceApps = vi.fn();
const refetchAppData = vi.fn();
const restartServiceAppMutate = vi.fn();
const revokeServiceActionGrantMutate = vi.fn();
const resetDeleteServiceApp = vi.fn();

vi.mock('@/features/app-data/hooks/use-app-data', () => ({
  useAppData: () => ({
    data: {
      entries: [{
        id: 'ad1.workspace-notes',
        appId: 'notes',
        instanceId: 'default',
        displayName: 'Notes',
        source: 'workspace-service',
        lifecycle: 'active',
        storage: {
          layout: 'instance-v1',
          layoutVersion: 1,
          instanceId: 'default',
          instanceDirectory: '/workspace/.nextclaw/app-instances/notes/default',
          dataDirectory: '/workspace/.nextclaw/app-instances/notes/default/data',
          configDirectory: '/workspace/.nextclaw/app-instances/notes/default/config',
          stateDirectory: '/workspace/.nextclaw/app-instances/notes/default/state',
          cacheDirectory: '/workspace/.nextclaw/app-instances/notes/default/cache',
          temporaryDirectory: '/workspace/.nextclaw/app-instances/notes/default/tmp',
          logsDirectory: '/workspace/.nextclaw/app-instances/notes/default/logs',
        },
        usage: {
          dataBytes: 12,
          configBytes: 0,
          stateBytes: 0,
          cacheBytes: 0,
          temporaryBytes: 0,
          logsBytes: 0,
          totalBytes: 12,
        },
        createdAt: '2026-08-14T00:00:00.000Z',
        actions: { deleteRetainedData: false },
      }],
      diagnostics: [],
    },
    error: null,
    isLoading: false,
    refetch: refetchAppData,
  }),
}));

vi.mock('@/features/service-apps/hooks/use-service-apps', () => ({
  useDeleteServiceApp: () => ({
    error: null,
    isPending: false,
    mutate: deleteServiceAppMutate,
    reset: resetDeleteServiceApp,
  }),
  useDiscoverServiceAppActions: () => ({
    isPending: false,
    mutateAsync: discoverServiceAppActionsMutateAsync,
  }),
  useRestartServiceApp: () => ({
    mutate: restartServiceAppMutate,
  }),
  useRevokeServiceActionGrant: () => ({
    mutate: revokeServiceActionGrantMutate,
  }),
  useServiceActionGrants: () => ({
    data: { grants: [] },
    isError: false,
    isLoading: false,
    refetch: refetchServiceActionGrants,
  }),
  useServiceActions: () => ({
    data: { actions: [] },
    isError: false,
    isLoading: false,
    refetch: refetchServiceActions,
  }),
  useServiceApps: () => ({
    data: {
      entries: [{
        args: ['server.mjs'],
        command: 'node',
        cwd: '/workspace/service-apps/notes',
        dirPath: '/workspace/service-apps/notes',
        enabled: true,
        id: 'notes',
        manifestPath: '/workspace/service-apps/notes/service-app.json',
        protocol: 'mcp',
        status: 'idle',
        title: 'Notes',
      }],
      serviceAppsPath: '/workspace/service-apps',
      workspacePath: '/workspace',
    },
    isError: false,
    isLoading: false,
    refetch: refetchServiceApps,
  }),
}));

describe('ServiceAppsPanel', () => {
  it('keeps service actions progressive and deletes through a confirm dialog', async () => {
    const user = userEvent.setup();

    render(<ServiceAppsPanel />);

    expect(screen.getByText('Not connected')).toBeTruthy();
    expect(screen.queryByText('idle')).toBeNull();
    const discoverButton = screen.getByRole('button', { name: 'Connect and discover actions' });
    expect(discoverButton).toBeTruthy();
    await user.hover(discoverButton);
    await waitFor(() => {
      expect(screen.queryAllByText('Connect to the service app runtime and discover its available actions.').length).toBeGreaterThan(0);
    });

    await user.click(discoverButton);
    expect(discoverServiceAppActionsMutateAsync).toHaveBeenCalledWith('notes');

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect((screen.getByRole('button', { name: 'Disconnect runtime' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete service app' }));
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    });
    expect(resetDeleteServiceApp).toHaveBeenCalled();
    expect(screen.getByText('Total app data')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Keep personal data/ }).getAttribute('aria-pressed'))
      .toBe('true');
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete service app' });
    fireEvent.click(deleteButtons.at(-1)!);

    expect(deleteServiceAppMutate).toHaveBeenCalledWith(
      { appId: 'notes', purgeData: false },
      { onSuccess: expect.any(Function) },
    );
  });
});
