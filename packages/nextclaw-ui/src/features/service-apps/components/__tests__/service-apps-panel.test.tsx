import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ServiceAppsPanel } from '@/features/service-apps/components/service-apps-panel';

const deleteServiceAppMutate = vi.fn();
const discoverServiceAppActionsMutateAsync = vi.fn(async () => ({ actions: [] }));
const refetchServiceActions = vi.fn();
const refetchServiceActionGrants = vi.fn();
const refetchServiceApps = vi.fn();
const restartServiceAppMutate = vi.fn();
const revokeServiceActionGrantMutate = vi.fn();

vi.mock('@/features/service-apps/hooks/use-service-apps', () => ({
  useDeleteServiceApp: () => ({
    isPending: false,
    mutate: deleteServiceAppMutate,
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
  it('labels service app icon actions and deletes through a confirm dialog', async () => {
    const user = userEvent.setup();

    render(<ServiceAppsPanel />);

    expect(screen.getByText('Not connected')).toBeTruthy();
    expect(screen.queryByText('idle')).toBeNull();
    const discoverButton = screen.getByRole('button', { name: 'Connect and discover actions' });
    expect(discoverButton).toBeTruthy();
    const disconnectButton = screen.getByRole('button', { name: 'Disconnect runtime' });
    expect(disconnectButton).toBeTruthy();
    expect((disconnectButton as HTMLButtonElement).disabled).toBe(true);
    await user.hover(discoverButton);
    await waitFor(() => {
      expect(screen.queryAllByText('Connect to the service app runtime and discover its available actions.').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete service app' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(deleteServiceAppMutate).toHaveBeenCalledWith('notes');
  });
});
