import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ChatSessionChildSessions } from '@/features/chat/features/workspace/components/child-sessions/chat-session-child-sessions';
import type { ResolvedChildSessionTab } from '@/features/chat/features/ncp/hooks/use-ncp-child-session-tabs-view';

const mocks = vi.hoisted(() => ({
  copyText: vi.fn(),
  openSideChatDraft: vi.fn(),
  selectChildSessionDetail: vi.fn(),
}));

vi.mock('@nextclaw/agent-chat-ui', () => ({
  copyText: mocks.copyText,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/features/chat/components/providers/chat-presenter.provider', () => ({
  usePresenter: () => ({ chatThreadManager: mocks }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.copyText.mockResolvedValue(true);
});

function createChildSession(): ResolvedChildSessionTab {
  return {
    sessionKey: 'child-1',
    parentSessionKey: 'parent-1',
    title: 'Research branch',
    agentId: 'main',
    updatedAt: null,
    lastMessageAt: null,
    readAt: null,
    runStatus: undefined,
    sessionTypeLabel: 'Native',
    preferredModel: 'openai/gpt-5',
    projectName: 'nextbot',
    projectRoot: '/tmp/nextbot',
  };
}

it('opens a new child-session draft from the management page', async () => {
  const user = userEvent.setup();
  render(<ChatSessionChildSessions childSessionTabs={[]} sessionKey="parent-1" />);

  expect(screen.getByText('No child sessions yet.')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'New child session' }));
  expect(mocks.openSideChatDraft).toHaveBeenCalledWith('parent-1');
});

it('keeps existing child sessions selectable beside the create action', async () => {
  const user = userEvent.setup();
  render(<ChatSessionChildSessions childSessionTabs={[createChildSession()]} sessionKey="parent-1" />);

  expect(screen.getByRole('button', { name: 'New child session' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: /Research branch/ }));
  expect(mocks.selectChildSessionDetail).toHaveBeenCalledWith('child-1');
});

it('shows a spinner only for child sessions that are running', () => {
  render(
    <ChatSessionChildSessions
      childSessionTabs={[
        createChildSession(),
        {
          ...createChildSession(),
          sessionKey: 'child-2',
          title: 'Running branch',
          runStatus: 'running',
        },
      ]}
      sessionKey="parent-1"
    />,
  );

  expect(screen.getAllByLabelText('Running')).toHaveLength(1);
  expect(screen.getByRole('button', { name: /Running branch.*Running/ })).toBeTruthy();
});

it('copies a child session ID from its own more-actions menu', async () => {
  const user = userEvent.setup();
  render(<ChatSessionChildSessions childSessionTabs={[createChildSession()]} sessionKey="parent-1" />);

  await user.click(screen.getByRole('button', { name: 'More actions' }));
  await user.click(screen.getByRole('button', { name: 'Copy session ID' }));

  expect(mocks.copyText).toHaveBeenCalledWith('child-1');
  expect(mocks.selectChildSessionDetail).not.toHaveBeenCalled();
});

vi.mock("react-router-dom", async (importOriginal) => ({ ...(await importOriginal<object>()), useNavigate: () => vi.fn(), useLocation: () => ({ pathname: '/chat', search: '' }) }));
vi.mock("@/features/panel-apps/hooks/use-panel-apps", () => ({ usePanelApps: () => ({ data: { entries: [] } }), useUpdatePanelAppPreferences: () => ({ mutate: vi.fn() }) }));
vi.mock("@/app/components/app-presenter-provider", async () => {
  const { PageResourceManager } = await import("@/features/right-panel-resources/managers/page-resource.manager");
  const app = { docBrowserManager: { openTarget: vi.fn() }, chatComposerIntentManager: { requestUiResourceReference: vi.fn() } };
  return { useAppPresenter: () => ({ ...app, pageResourceManager: new PageResourceManager(app as never) }) };
});
