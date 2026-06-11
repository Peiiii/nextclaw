import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PanelAppsList } from '@/features/panel-apps/components/panel-apps-list';

const mocks = vi.hoisted(() => ({
  entries: [] as Array<{
    appId: string;
    clientDeclared: boolean;
    clientGranted: boolean;
    contentPath: string;
    createdAt: string;
    description?: string;
    favorite: boolean;
    fileName: string;
    id: string;
    kind: 'single-file';
    openCount: number;
    sizeBytes: number;
    title: string;
    updatedAt: string;
  }>,
  navigate: vi.fn(),
  refetchPanelApps: vi.fn(),
  requestDraft: vi.fn(),
}));

vi.mock('@/app/components/app-presenter-provider', () => ({
  useAppPresenter: () => ({
    chatDraftIntentManager: {
      requestDraft: mocks.requestDraft,
    },
    serviceActionAuthorizationManager: {
      requestAuthorization: vi.fn(async () => true),
    },
  }),
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom') as object),
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/features/panel-apps/hooks/use-panel-apps', () => ({
  useDeletePanelApp: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
  useGrantPanelAppClient: () => ({
    mutateAsync: vi.fn(),
  }),
  usePanelApps: () => ({
    data: {
      entries: mocks.entries,
      panelsPath: '/workspace/panels',
      workspacePath: '/workspace',
    },
    isError: false,
    isLoading: false,
    refetch: mocks.refetchPanelApps,
  }),
  useRecordPanelAppOpened: () => ({
    mutateAsync: vi.fn(async (id: string) => mocks.entries.find((entry) => entry.id === id)),
  }),
  useUpdatePanelAppPreferences: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
}));

function createPanelAppEntry(overrides: Partial<(typeof mocks.entries)[number]> = {}) {
  return {
    appId: 'demo',
    clientDeclared: false,
    clientGranted: false,
    contentPath: '/api/panel-apps/demo/content',
    createdAt: '2026-05-28T08:00:00.000Z',
    description: 'A compact demo panel.',
    favorite: false,
    fileName: 'demo.panel.html',
    id: 'demo',
    kind: 'single-file' as const,
    openCount: 0,
    sizeBytes: 12,
    title: 'Demo Panel',
    updatedAt: '2026-05-28T09:00:00.000Z',
    ...overrides,
  };
}

describe('PanelAppsList', () => {
  beforeEach(() => {
    mocks.entries = [];
    mocks.navigate.mockReset();
    mocks.refetchPanelApps.mockReset();
    mocks.requestDraft.mockReset();
  });

  it('shows first-use guidance when no panel apps exist', async () => {
    const user = userEvent.setup();

    render(<PanelAppsList onOpenPanelApp={vi.fn()} />);

    expect(screen.getByText('Create your first panel app')).toBeTruthy();
    expect(screen.getByText('Ask NextClaw to generate one')).toBeTruthy();
    expect(screen.getByText('/workspace/panels')).toBeTruthy();

    await user.click(screen.getAllByRole('button', { name: 'Refresh panel apps' }).at(-1)!);

    expect(mocks.refetchPanelApps).toHaveBeenCalledTimes(1);
  });

  it('fills a sample panel app prompt from first-use guidance', async () => {
    const user = userEvent.setup();

    render(<PanelAppsList onOpenPanelApp={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Create sample panel app/ }));

    expect(mocks.requestDraft).toHaveBeenCalledWith(expect.stringContaining('personal task board'));
    expect(mocks.navigate).toHaveBeenCalledWith('/chat');
  });

  it('shows a filtered empty state instead of first-use guidance when apps exist', async () => {
    const user = userEvent.setup();
    mocks.entries = [createPanelAppEntry()];

    render(<PanelAppsList onOpenPanelApp={vi.fn()} />);

    expect(screen.getByText('Demo Panel')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Favorites' }));

    expect(screen.getByText('No panel apps in this view')).toBeTruthy();
    expect(screen.queryByText('Create your first panel app')).toBeNull();
  });
});
