import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUpdatePanelAppPreferences } from '@/features/panel-apps/hooks/use-panel-apps';
import type { PanelAppEntryView, PanelAppListView } from '@/shared/lib/api';
import type * as SharedApi from '@/shared/lib/api';

const mocks = vi.hoisted(() => ({
  updatePreferences: vi.fn(),
}));

vi.mock('@/shared/lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof SharedApi>();
  return {
    ...original,
    nextclawClient: {
      ...original.nextclawClient,
      panelApps: {
        ...original.nextclawClient.panelApps,
        updatePanelAppPreferences: mocks.updatePreferences,
      },
    },
  };
});

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const entry: PanelAppEntryView = {
  id: 'todo',
  appId: 'publisher.todo',
  fileName: 'todo',
  kind: 'folder',
  title: 'Todo',
  contentPath: '/api/panel-apps/publisher.todo/content',
  createdAt: '2026-08-19T00:00:00.000Z',
  updatedAt: '2026-08-19T00:00:00.000Z',
  sizeBytes: 1,
  favorite: false,
  mainSidebar: false,
  clientDeclared: false,
  clientGranted: false,
  openCount: 0,
};

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData<PanelAppListView>(['panel-apps'], {
    workspacePath: '/workspace',
    panelsPath: '/workspace/panels',
    entries: [entry],
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

describe('useUpdatePanelAppPreferences', () => {
  beforeEach(() => {
    mocks.updatePreferences.mockReset();
  });

  it('updates the main-sidebar cache before local persistence completes', async () => {
    let resolveRequest: (value: PanelAppEntryView) => void = () => undefined;
    mocks.updatePreferences.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    const { queryClient, wrapper } = createHarness();
    const { result } = renderHook(() => useUpdatePanelAppPreferences(), { wrapper });

    act(() => result.current.mutate({
      id: entry.id,
      preferences: { mainSidebar: true },
    }));

    await waitFor(() => expect(
      queryClient.getQueryData<PanelAppListView>(['panel-apps'])?.entries[0]?.mainSidebar,
    ).toBe(true));
    expect(result.current.isPending).toBe(true);

    resolveRequest({ ...entry, mainSidebar: true, mainSidebarOrder: 0 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('rolls the optimistic entry back when persistence fails', async () => {
    mocks.updatePreferences.mockRejectedValue(new Error('write failed'));
    const { queryClient, wrapper } = createHarness();
    const { result } = renderHook(() => useUpdatePanelAppPreferences(), { wrapper });

    act(() => result.current.mutate({
      id: entry.id,
      preferences: { mainSidebar: true },
    }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(
      queryClient.getQueryData<PanelAppListView>(['panel-apps'])?.entries[0]?.mainSidebar,
    ).toBe(false);
  });
});
